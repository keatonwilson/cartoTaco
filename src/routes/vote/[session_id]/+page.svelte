<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { processedTacoData, isLoading } from '$lib/stores.js';
  import { supabaseBrowser } from '$lib/supabaseBrowser.js';
  import SummitResults from '../../../components/SummitResults.svelte';
  import { dndzone } from 'svelte-dnd-action';

  $: sessionId = $page.params.session_id;

  // ─── State ────────────────────────────────────────────────────────────────

  let session = null;       // group_sessions row
  let votes = [];           // group_votes rows for this session
  let loadError = '';
  let dataLoading = true;

  // The spots in this session, in processedTacoData form
  $: sessionSites = session
    ? (session.site_ids || [])
        .map(id => $processedTacoData.find(s => s.est_id === id))
        .filter(Boolean)
    : [];

  // Whether the session is closed
  $: isLocked = !!session?.closed_at;

  // Voter identity stored in localStorage
  let voterToken = '';
  let creatorToken = '';

  $: isCreator = !!(creatorToken && session?.creator_token === creatorToken);

  // Has this browser already voted?
  $: hasVoted = voterToken
    ? votes.some(v => v.voter_token === voterToken)
    : false;

  // Distinct voter count
  $: voterCount = new Set(votes.map(v => v.voter_token)).size;

  // ─── Ballot state (ranked list for voting UI) ─────────────────────────────

  // rankedSpots is the ordered list the user is building; starts in session order
  let rankedSpots = [];
  let ballotReady = false;

  $: if (!ballotReady && sessionSites.length > 0) {
    // svelte-dnd-action requires items to have an `id` field (no keyField option)
    rankedSpots = sessionSites.map(s => ({ ...s, id: s.est_id }));
    ballotReady = true;
  }

  // svelte-dnd-action: use rankedSpots directly with keyField so there is no
  // derived array between the zone and the source of truth. A derived array
  // causes a reactive recompute on every consider event, which resets the
  // drag state mid-drag and makes items disappear.
  function handleDndConsider(e) {
    rankedSpots = e.detail.items;
  }

  function handleDndFinalize(e) {
    rankedSpots = e.detail.items;
  }

  function moveUp(index) {
    if (index === 0) return;
    const next = [...rankedSpots];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    rankedSpots = next;
  }

  function moveDown(index) {
    if (index === rankedSpots.length - 1) return;
    const next = [...rankedSpots];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    rankedSpots = next;
  }

  // ─── Submitting a ballot ──────────────────────────────────────────────────

  let submitting = false;
  let submitError = '';

  async function submitBallot() {
    if (!browser || submitting || !voterToken) return;
    submitting = true;
    submitError = '';

    // Delete any previous votes from this voter (allows re-voting while session is open)
    await supabaseBrowser
      .from('group_votes')
      .delete()
      .eq('session_id', sessionId)
      .eq('voter_token', voterToken);

    // Insert one row per spot with the voter's ranking
    const rows = rankedSpots.map((spot, i) => ({
      session_id: sessionId,
      voter_token: voterToken,
      est_id: spot.est_id,
      rank: i + 1,
    }));

    const { error } = await supabaseBrowser.from('group_votes').insert(rows);

    if (error) {
      submitError = 'Could not save your vote. Please try again.';
      submitting = false;
      return;
    }

    // Mark as voted in localStorage
    localStorage.setItem(`summit_voted_${sessionId}`, '1');
    submitting = false;
    await loadVotes();
  }

  // ─── Locking the session ──────────────────────────────────────────────────

  let locking = false;

  async function lockSession() {
    if (!isCreator || locking) return;
    locking = true;
    const { error } = await supabaseBrowser
      .from('group_sessions')
      .update({ closed_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('creator_token', creatorToken);
    if (error) { locking = false; }
    // Realtime will update session; also reload just in case
    await loadSession();
    locking = false;
  }

  // ─── Copying the share link ───────────────────────────────────────────────

  let copied = false;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => { copied = false; }, 2500);
    } catch { /* silent */ }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadSession() {
    const { data, error } = await supabaseBrowser
      .from('group_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error || !data) {
      loadError = 'Summit not found.';
    } else {
      session = data;
    }
  }

  async function loadVotes() {
    const { data } = await supabaseBrowser
      .from('group_votes')
      .select('voter_token, est_id, rank')
      .eq('session_id', sessionId);
    votes = data || [];
  }

  // ─── Realtime subscriptions ───────────────────────────────────────────────

  let votesChannel;
  let sessionChannel;

  function subscribeRealtime() {
    votesChannel = supabaseBrowser
      .channel(`summit-votes-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_votes',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadVotes())
      .subscribe();

    sessionChannel = supabaseBrowser
      .channel(`summit-session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'group_sessions',
        filter: `id=eq.${sessionId}`,
      }, payload => { session = payload.new; })
      .subscribe();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!browser) return;

    // Restore voter / creator tokens from localStorage
    voterToken = localStorage.getItem(`summit_voter_${sessionId}`) || (() => {
      const t = crypto.randomUUID();
      localStorage.setItem(`summit_voter_${sessionId}`, t);
      return t;
    })();

    creatorToken = localStorage.getItem(`summit_creator_${sessionId}`) || '';

    await Promise.all([loadSession(), loadVotes()]);
    dataLoading = false;
    subscribeRealtime();
  });

  onDestroy(() => {
    votesChannel?.unsubscribe();
    sessionChannel?.unsubscribe();
  });
</script>

<div class="page">
  <div class="container">
    <button class="back-btn" on:click={() => goto('/')}>&larr; Back to Map</button>

    {#if dataLoading || $isLoading}
      <div class="status-msg">Loading summit…</div>

    {:else if loadError}
      <div class="error-block">
        <div class="error-icon">🌮</div>
        <p>{loadError}</p>
        <button class="create-btn-sm" on:click={() => goto('/vote/new')}>Start a new summit</button>
      </div>

    {:else if session}
      <!-- Session header -->
      <div class="session-header">
        <h1 class="session-title">{session.title}</h1>
        {#if isLocked}
          <span class="badge badge-locked">Results locked</span>
        {:else}
          <span class="badge badge-open">Voting open</span>
        {/if}
      </div>

      <!-- ── CREATOR CONTROLS (open session) ── -->
      {#if isCreator && !isLocked}
        <div class="creator-panel">
          <p class="creator-label">You created this summit</p>
          <div class="share-row">
            <input
              type="text"
              readonly
              class="share-input"
              value={browser ? window.location.href : ''}
            />
            <button class="copy-btn" on:click={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <div class="creator-footer">
            <span class="voter-count">{voterCount} {voterCount === 1 ? 'vote' : 'votes'} so far</span>
            <button
              class="lock-btn"
              disabled={locking || voterCount === 0}
              on:click={lockSession}
              title={voterCount === 0 ? 'Wait for at least one vote before locking' : 'Lock and reveal results'}
            >
              {locking ? 'Locking…' : 'Lock & reveal results'}
            </button>
          </div>
        </div>
      {/if}

      <!-- ── SHARE NUDGE (non-creator, open) ── -->
      {#if !isCreator && !isLocked && !hasVoted}
        <div class="share-nudge">
          Share this page with your crew so they can vote too.
        </div>
      {/if}

      <!-- ── RESULTS (locked) ── -->
      {#if isLocked}
        <SummitResults {votes} sites={sessionSites} locked={true} title={session.title} showDownload={true} />

      <!-- ── VOTED ALREADY (open) ── -->
      {:else if hasVoted}
        <div class="voted-banner">
          <span class="voted-icon">✓</span>
          <div>
            <div class="voted-title">Your ballot is in!</div>
            <div class="voted-sub">Waiting for the creator to lock the results.</div>
          </div>
        </div>
        <!-- Live preview while waiting -->
        {#if votes.length > 0}
          <SummitResults {votes} sites={sessionSites} locked={false} title={session.title} />
        {/if}

      <!-- ── BALLOT (open, not yet voted) ── -->
      {:else}
        <div class="ballot-section">
          <h2 class="ballot-heading">Rank the spots</h2>
          <p class="ballot-sub">Drag to reorder, or use the arrows. #1 is your top pick.</p>

          <ol
            class="ballot-list"
            use:dndzone={{ items: rankedSpots }}
            on:consider={handleDndConsider}
            on:finalize={handleDndFinalize}
          >
            {#each rankedSpots as spot, i (spot.est_id)}
              <li class="ballot-item">
                <span class="drag-handle" aria-hidden="true">⠿</span>
                <span class="rank-num">{i + 1}</span>
                <div class="ballot-arrows">
                  <button
                    class="arrow-btn"
                    disabled={i === 0}
                    on:click={() => moveUp(i)}
                    aria-label="Move up"
                  >▲</button>
                  <button
                    class="arrow-btn"
                    disabled={i === rankedSpots.length - 1}
                    on:click={() => moveDown(i)}
                    aria-label="Move down"
                  >▼</button>
                </div>
                <div class="ballot-spot-info">
                  <span class="ballot-spot-name">{spot.name}</span>
                  <span class="ballot-spot-type">{spot.type}</span>
                </div>
              </li>
            {/each}
          </ol>

          {#if submitError}
            <div class="submit-error">{submitError}</div>
          {/if}

          <button
            class="submit-btn"
            disabled={submitting}
            on:click={submitBallot}
          >
            {submitting ? 'Submitting…' : 'Submit my rankings'}
          </button>
        </div>
      {/if}

      <!-- Spots list footer (always shown for reference) -->
      {#if !isLocked && sessionSites.length > 0}
        <div class="spots-footer">
          {sessionSites.length} spot{sessionSites.length !== 1 ? 's' : ''} in this summit
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 2rem 1rem 4rem;
  }

  :global(.dark) .page { background: #0a0e1a; }

  .container {
    max-width: 560px;
    margin: 0 auto;
  }

  .back-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
    margin-bottom: 1.5rem;
  }
  .back-btn:hover { color: #FE795D; }
  :global(.dark) .back-btn { color: #9ca3af; }

  .status-msg {
    padding: 3rem;
    text-align: center;
    color: #9ca3af;
    font-style: italic;
  }

  .error-block {
    text-align: center;
    padding: 3rem 1rem;
  }

  .error-icon { font-size: 3rem; margin-bottom: 1rem; }

  .error-block p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  :global(.dark) .error-block p { color: #9ca3af; }

  .create-btn-sm {
    padding: 0.625rem 1.25rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .create-btn-sm:hover { background: #EF562F; }

  /* Session header */
  .session-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 1.25rem;
  }

  .session-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #111827;
    margin: 0;
    flex: 1;
  }
  :global(.dark) .session-title { color: #f9fafb; }

  .badge {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .badge-open {
    background: rgba(254, 121, 93, 0.12);
    color: #FE795D;
  }

  .badge-locked {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
  }

  :global(.dark) .badge-locked { color: #34d399; }

  /* Creator panel */
  .creator-panel {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }

  :global(.dark) .creator-panel {
    background: #1f2937;
    border-color: #374151;
  }

  .creator-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #FE795D;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0 0 0.75rem;
  }

  .share-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .share-input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: #374151;
    background: white;
  }

  :global(.dark) .share-input {
    background: #111827;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .copy-btn {
    padding: 0.5rem 0.875rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .copy-btn:hover { background: #EF562F; }

  .creator-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .voter-count {
    font-size: 0.8rem;
    color: #6b7280;
  }
  :global(.dark) .voter-count { color: #9ca3af; }

  .lock-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    color: #059669;
    border: 1px solid #059669;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .lock-btn:hover:not(:disabled) {
    background: #059669;
    color: white;
  }
  .lock-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Share nudge */
  .share-nudge {
    font-size: 0.85rem;
    color: #6b7280;
    background: #f3f4f6;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1.25rem;
    font-style: italic;
  }
  :global(.dark) .share-nudge {
    background: #1f2937;
    color: #9ca3af;
  }

  /* Voted banner */
  .voted-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: rgba(16, 185, 129, 0.08);
    border-left: 4px solid #10b981;
    border-radius: 0 0.5rem 0.5rem 0;
    margin-bottom: 1.5rem;
  }

  .voted-icon {
    font-size: 1.1rem;
    color: #10b981;
    font-weight: 800;
    line-height: 1.3;
  }

  .voted-title {
    font-weight: 700;
    color: #111827;
    font-size: 0.9rem;
  }
  :global(.dark) .voted-title { color: #f9fafb; }

  .voted-sub {
    font-size: 0.8rem;
    color: #6b7280;
    margin-top: 0.15rem;
  }
  :global(.dark) .voted-sub { color: #9ca3af; }

  /* Ballot */
  .ballot-section { margin-bottom: 1.5rem; }

  .ballot-heading {
    font-size: 1.1rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.25rem;
  }
  :global(.dark) .ballot-heading { color: #f9fafb; }

  .ballot-sub {
    font-size: 0.82rem;
    color: #6b7280;
    margin: 0 0 1rem;
  }
  :global(.dark) .ballot-sub { color: #9ca3af; }

  .ballot-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }
  :global(.dark) .ballot-list { border-color: #374151; }

  .ballot-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border-bottom: 1px solid #f3f4f6;
    transition: background 0.1s;
  }
  :global(.dark) .ballot-item {
    background: #1f2937;
    border-bottom-color: #374151;
  }
  .ballot-item:last-child { border-bottom: none; }

  .drag-handle {
    color: #9ca3af;
    font-size: 1.1rem;
    cursor: grab;
    flex-shrink: 0;
    user-select: none;
    padding: 0 2px;
  }
  .drag-handle:active { cursor: grabbing; }
  :global(.dark) .drag-handle { color: #6b7280; }

  .rank-num {
    font-size: 1rem;
    font-weight: 800;
    color: #FE795D;
    width: 1.5rem;
    text-align: center;
    flex-shrink: 0;
  }

  .ballot-arrows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
  }

  .arrow-btn {
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 3px;
    color: #6b7280;
    font-size: 0.6rem;
    cursor: pointer;
    width: 22px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.1s;
  }
  .arrow-btn:hover:not(:disabled) {
    background: rgba(254, 121, 93, 0.1);
    border-color: #FE795D;
    color: #FE795D;
  }
  .arrow-btn:disabled { opacity: 0.25; cursor: not-allowed; }
  :global(.dark) .arrow-btn {
    border-color: #4b5563;
    color: #9ca3af;
  }

  .ballot-spot-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .ballot-spot-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.dark) .ballot-spot-name { color: #f9fafb; }

  .ballot-spot-type {
    font-size: 0.72rem;
    color: #9ca3af;
  }

  .submit-error {
    padding: 0.625rem 0.875rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 0.375rem;
    color: #dc2626;
    font-size: 0.8rem;
    margin-bottom: 0.75rem;
  }

  .submit-btn {
    width: 100%;
    padding: 0.875rem;
    background: #FE795D;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s;
  }
  .submit-btn:hover:not(:disabled) { background: #EF562F; }
  .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Footer */
  .spots-footer {
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
    margin-top: 1.5rem;
  }
</style>
