<script>
  // The concierge chat (src/lib/agentStore.js → /api/agent). A launcher at the
  // bottom right of the map opens a panel docked right under the header on
  // desktop/tablet (the mirror of SpotPanel; Map.svelte moves the filter bar and
  // map controls aside) and a bottom sheet on phones. Signed-in only.
  import { onDestroy, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { browser } from '$app/environment';
  import ChatCircleDots from 'phosphor-svelte/lib/ChatCircleDots';
  import PaperPlaneRight from 'phosphor-svelte/lib/PaperPlaneRight';
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import ThumbsUp from 'phosphor-svelte/lib/ThumbsUp';
  import ThumbsDown from 'phosphor-svelte/lib/ThumbsDown';
  import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import NotePencil from 'phosphor-svelte/lib/NotePencil';
  import X from 'phosphor-svelte/lib/X';
  import {
    chatMessages, chatPending, ask, applyActions, undoMessage, sendFeedback, clearChat
  } from '$lib/agentStore';
  import { chatOpen, CHAT_PANEL_WIDTH } from '$lib/uiStore';
  import { isAuthenticated } from '$lib/authStore';
  import { trailModeActive } from '$lib/trailStore';
  import { comparisonActive } from '$lib/comparisonStore';
  import { selectedSite, processedTacoData } from '$lib/stores';
  import { isMobile } from '$lib/deviceDetection';
  import { listen, speechSupported, describeVoiceError } from '$lib/voice';

  const EXAMPLES = ['Spicy pork open now', 'Where can I get birria from a truck?', 'A walking trail near Tacos Apson', 'Pick a spot for me'];

  let input = '';
  let inputEl;
  let scroller;

  // Sit above whichever tray is open, like the map padding does
  $: launcherBottom = $trailModeActive ? 296 : $comparisonActive ? 176 : 32;
  // On phones the launcher would cover the spot's bottom sheet
  $: showLauncher = !$chatOpen && !($isMobile && $selectedSite);

  async function open() {
    chatOpen.set(true);
    await tick();
    inputEl?.focus();
  }

  async function newChat() {
    clearChat();
    input = '';
    await tick();
    inputEl?.focus();
  }

  function submit(text = input) {
    if (!text.trim() || $chatPending) return;
    ask(text);
    input = '';
  }

  // Keep the newest message in view. The element goes through a parameter:
  // assigning `scroller.scrollTop` directly would invalidate `scroller` and
  // re-run this statement forever.
  const scrollToEnd = (el) => el && (el.scrollTop = el.scrollHeight);
  $: if (scroller && ($chatMessages.length || $chatPending)) {
    const el = scroller;
    tick().then(() => scrollToEnd(el));
  }

  /**
   * "Tacos Apson [#4] is open" → [{ spot: 4, name: 'Tacos Apson' }, { text: ' is open' }].
   * The name before a citation becomes the link; an unknown id is dropped.
   */
  function parts(text, sites) {
    const out = [];
    text.split(/\s*\[#(\d+)\]/).forEach((piece, i) => {
      if (!(i % 2)) return out.push({ text: piece });
      const site = sites.find((s) => s.est_id === Number(piece));
      if (!site) return;
      const prev = out[out.length - 1];
      if (prev.text.toLowerCase().endsWith(site.name.toLowerCase())) {
        prev.text = prev.text.slice(0, -site.name.length);
      } else {
        prev.text += ' ';
      }
      out.push({ spot: site.est_id, name: site.name });
    });
    return out;
  }

  // ── Voice: a final result is sent straight away ──
  let canSpeak = false;
  let listening = false;
  let voiceError = null;
  let stopListening = null;
  let voiceSession = 0;
  $: if (browser) canSpeak = speechSupported();

  function toggleVoice() {
    if (listening) return stopVoice();
    const session = ++voiceSession;
    const isCurrent = () => session === voiceSession;
    voiceError = null;
    listening = true;
    stopListening = listen({
      onResult: (text) => isCurrent() && text && submit(text),
      onError: (code) => { if (isCurrent()) voiceError = describeVoiceError(code); },
      onEnd: () => {
        if (!isCurrent()) return;
        listening = false;
        stopListening = null;
      }
    });
  }

  function stopVoice() {
    const stop = stopListening;
    voiceSession++;
    stopListening = null;
    listening = false;
    stop?.();
  }

  onDestroy(stopVoice);

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      chatOpen.set(false);
    }
  }
</script>

{#if showLauncher}
  <button class="chat-launcher" style="bottom: {launcherBottom}px" on:click={open} aria-label="Ask the concierge">
    <ChatCircleDots size={20} weight="bold" />
    <span>Ask</span>
  </button>
{/if}

{#if $chatOpen}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <section
    class="chat-panel"
    class:sheet={$isMobile}
    class:compact={!$isAuthenticated}
    style={$isMobile ? '' : `width: ${CHAT_PANEL_WIDTH}px`}
    aria-label="Concierge chat"
    on:keydown={onKeydown}
    transition:fly={{ x: $isMobile ? 0 : CHAT_PANEL_WIDTH, y: $isMobile ? 240 : 0, duration: 220 }}
  >
    <header>
      <div>
        <span class="kicker">Concierge</span>
        <h2>Ask CartoTaco</h2>
      </div>
      <div class="header-actions">
        {#if $chatMessages.length}
          <button class="new-chat" on:click={newChat}><NotePencil size={14} /> New chat</button>
        {/if}
        <button class="icon-btn" on:click={() => chatOpen.set(false)} aria-label="Close the concierge"><X size={16} /></button>
      </div>
    </header>

    {#if !$isAuthenticated}
      <div class="empty signed-out">
        <ChatCircleDots size={32} weight="duotone" />
        <p>Ask about Tucson’s taco spots in English or Spanish, and the concierge filters the map and opens cards for you.</p>
        <a class="signin" href="/login">Sign in to ask</a>
      </div>
    {:else}
      <div class="messages" bind:this={scroller} aria-live="polite">
        {#if !$chatMessages.length}
          <div class="empty">
            <p>Ask about spots, salsas, hours or what to eat. I can filter the map, open cards, plan a trail, compare spots or set up a Taco Summit.</p>
            <div class="examples">
              {#each EXAMPLES as example}
                <button on:click={() => submit(example)}>{example}</button>
              {/each}
            </div>
          </div>
        {/if}

        {#each $chatMessages as msg (msg.id)}
          <div class="msg {msg.role}" class:error={msg.error}>
            <p>
              {#each msg.role === 'assistant' ? parts(msg.content, $processedTacoData) : [{ text: msg.content }] as part}
                {#if part.spot}<button
                    class="spot-link"
                    on:click={() => applyActions([{ type: 'show_spot', est_id: part.spot }])}
                    title="Show on the map"
                  ><MapPin size={12} weight="fill" />{part.name}</button>{:else}{part.text}{/if}
              {/each}
            </p>
            {#if msg.sources}
              <p class="sources">
                Sources:
                {#each msg.sources as s, i}{#if i}; {/if}{#if s.url}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.by}</a>{:else}{s.by}{/if}{#if s.title && s.title !== s.by}, <cite>{s.title}</cite>{/if}{/each}
              </p>
            {/if}
            {#if msg.role === 'assistant' && !msg.error}
              <div class="msg-actions">
                {#if msg.undo}
                  <button class="undo" on:click={() => undoMessage(msg.id)}>
                    <ArrowCounterClockwise size={13} /> Undo filters
                  </button>
                {:else if msg.undone}
                  <span class="undone">Filters restored</span>
                {/if}
                {#if msg.run_id}
                  <span class="feedback">
                    <button
                      class:chosen={msg.feedback === 1}
                      disabled={msg.feedback != null}
                      on:click={() => sendFeedback(msg.id, 1)}
                      aria-label="Good answer"
                    ><ThumbsUp size={14} weight={msg.feedback === 1 ? 'fill' : 'regular'} /></button>
                    <button
                      class:chosen={msg.feedback === 0}
                      disabled={msg.feedback != null}
                      on:click={() => sendFeedback(msg.id, 0)}
                      aria-label="Bad answer"
                    ><ThumbsDown size={14} weight={msg.feedback === 0 ? 'fill' : 'regular'} /></button>
                  </span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}

        {#if $chatPending}
          <div class="msg assistant pending" aria-label="Thinking"><span></span><span></span><span></span></div>
        {/if}
      </div>

      {#if voiceError}<p class="voice-error">{voiceError}</p>{/if}

      <form on:submit|preventDefault={() => submit()}>
        <input
          bind:this={inputEl}
          bind:value={input}
          maxlength="500"
          placeholder={listening ? 'Listening…' : 'Ask about spots, salsas, hours…'}
          aria-label="Ask the concierge"
        />
        {#if canSpeak}
          <button type="button" class="icon-btn mic" class:listening on:click={toggleVoice}
            aria-label={listening ? 'Stop listening' : 'Speak your question'}><Microphone size={16} /></button>
        {/if}
        <button type="submit" class="icon-btn send" disabled={!input.trim() || $chatPending} aria-label="Send">
          <PaperPlaneRight size={16} weight="fill" />
        </button>
      </form>
    {/if}
  </section>
{/if}

<style>
  .chat-launcher {
    position: fixed;
    right: 16px;
    z-index: 60; /* above the trays (50) */
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: none;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font: 600 0.95rem var(--font-text);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    transition: bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.15s ease;
  }

  .chat-launcher:hover {
    background: var(--accent-hover);
  }

  .chat-panel {
    position: fixed;
    top: var(--header-h);
    right: 0;
    bottom: 0;
    max-width: 100vw;
    z-index: 120; /* level with the spot panel: above the trays (50), below FilterBar (200) */
    display: flex;
    flex-direction: column;
    background: var(--surface-1);
    color: var(--ink-1);
    border-left: 1px solid var(--line-1);
    box-shadow: -8px 0 28px -16px rgba(0, 0, 0, 0.35);
    font-family: var(--font-text);
  }

  .chat-panel.sheet {
    top: auto;
    left: 0;
    height: 70dvh;
  }

  .chat-panel.sheet.compact {
    height: auto;
  }

  .chat-panel.sheet {
    z-index: 160; /* over the spot sheet (150) */
    border-left: none;
    border-top: 1px solid var(--line-1);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 28px -12px rgba(0, 0, 0, 0.35);
  }

  /* A hint of the map through the panel, like SpotPanel */
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .chat-panel {
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .chat-panel {
      background: var(--surface-1);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }

  header {
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 16px 14px 22px;
    border-bottom: 1px solid var(--line-1);
  }

  .kicker {
    font: 500 0.7rem var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-3);
  }

  h2 {
    margin: 2px 0 0;
    font: 600 1.4rem/1.2 var(--font-serif);
    color: var(--ink-1);
  }

  .new-chat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--line-1);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-2);
    font: 500 0.82rem var(--font-text);
    cursor: pointer;
  }

  .new-chat:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: 1px solid transparent;
    border-radius: 50%;
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--line-1);
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty {
    padding: 10px 10px 0;
    color: var(--ink-2);
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .empty p {
    margin: 0;
  }

  .signed-out {
    padding: 28px 22px;
    color: var(--ink-2);
  }

  .signed-out :global(svg) {
    color: var(--accent);
    margin-bottom: 10px;
  }

  .examples {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    margin-top: 12px;
  }

  .examples button {
    padding: 6px 12px;
    border: 1px solid var(--line-1);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-1);
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  .examples button:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .signin {
    display: inline-block;
    margin-top: 12px;
    padding: 8px 16px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
    text-decoration: none;
  }

  .msg {
    max-width: 88%;
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .msg p {
    margin: 0;
    padding: 8px 12px;
    border-radius: 12px;
    white-space: pre-wrap;
  }

  .msg.user {
    align-self: flex-end;
  }

  .msg.user p {
    background: var(--accent);
    color: var(--accent-contrast);
    border-bottom-right-radius: 4px;
  }

  .msg.assistant {
    align-self: flex-start;
  }

  .msg.assistant p {
    background: var(--surface-1);
    border: 1px solid var(--line-1);
    border-bottom-left-radius: 4px;
  }

  .msg.error p {
    color: var(--error);
  }

  .spot-link {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--accent-soft);
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .spot-link :global(svg) {
    align-self: center;
  }

  .spot-link:hover {
    text-decoration-color: currentColor;
  }

  .msg-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    padding-left: 4px;
    font-size: 0.78rem;
    color: var(--ink-3);
  }

  .sources {
    margin-top: 4px;
    padding-left: 4px;
    font-size: 0.74rem;
    line-height: 1.4;
    color: var(--ink-3);
  }

  .sources a {
    color: var(--ink-2);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .sources cite {
    font-style: italic;
  }

  .undo {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid var(--line-1);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-2);
    font-size: 0.78rem;
    cursor: pointer;
  }

  .undo:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .feedback {
    display: inline-flex;
    gap: 2px;
    margin-left: auto;
  }

  .feedback button {
    display: flex;
    padding: 3px;
    border: none;
    background: transparent;
    color: var(--ink-3);
    cursor: pointer;
  }

  .feedback button:hover:not(:disabled),
  .feedback button.chosen {
    color: var(--accent);
  }

  .feedback button:disabled:not(.chosen) {
    opacity: 0.35;
    cursor: default;
  }

  .pending {
    display: flex;
    gap: 4px;
    padding: 12px;
    background: var(--surface-2);
    border-radius: 12px;
  }

  .pending span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ink-3);
    animation: chat-dot 1s ease-in-out infinite;
  }

  .pending span:nth-child(2) { animation-delay: 0.15s; }
  .pending span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes chat-dot {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pending span { animation: none; }
  }

  .voice-error {
    margin: 0;
    padding: 0 16px 6px;
    color: var(--error);
    font-size: 0.8rem;
  }

  form {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 12px 12px;
    padding: 6px 6px 6px 14px;
    border: 1px solid var(--line-1);
    border-radius: 999px;
    background: var(--surface-1);
  }

  form:focus-within {
    border-color: var(--accent);
  }

  .sheet form {
    margin-bottom: max(12px, env(safe-area-inset-bottom));
  }

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--ink-1);
    font-size: 1rem; /* 16px keeps iOS from zooming on focus */
  }

  input::placeholder {
    color: var(--ink-3);
  }

  .send:not(:disabled) {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .mic.listening {
    background: var(--accent);
    color: var(--accent-contrast);
  }
</style>
