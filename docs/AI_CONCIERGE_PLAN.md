# AI Concierge Plan

Status: Phase 1 (Quick Search, intent rules, voice, `siteModel.js`) shipped. Phase 2 harness built and evaluated; phase 3 (endpoint, budget, chat panel, eval gate) built, see "Phase 3 as built". Phases 4–5 planned.

## Context
We want fast natural-language and voice search in CartoTaco, plus an AI agent that drives the app: filters, map, cards, trails, Summits, comparisons and taste-profile recommendations. Constraints from the discussion:
- **Cheap models first.** Build and prove the *harness* (routing, tools, prompts, evals) on cheap models before any UI polish. Don't break the bank.
- **A router (decision) model** decides how much machinery each query needs. Most queries should never reach an agent loop.
- **LangChain.js** (LangGraph dropped in phase 2, see below), with **LangSmith** for tracing and a **versioned golden dataset** for evals.
- Local search is free for everyone. The AI requires sign-in.

## Core design: a tiered cascade with the router in front
`src/lib/server/agent/concierge.js` (`runConcierge`) is a plain async function. Each query takes the cheapest path that can answer it:

```
query ─▶ T0 deterministic ──hit──▶ actions + templated reply                 ($0)
            │ miss
            ▼
         T1 router (Haiku 4.5, structured output, 1 call)
            │ intent ∈ {find_spot, filter, spot_fact, compare, trail, summit, recommend, chitchat, off_topic}
            │ + parsed slots + confidence
            ├─ simple intent & confident ─▶ deterministic handler + optional 1 Haiku sentence   (~1–2 calls)
            ├─ multi-step / low confidence ─▶ T2 Haiku ReAct agent, intent-scoped tool subset
            └─ T2 fails validation (bad args, empty results, step cap) ─▶ T3 Sonnet 5.5 escalation (budgeted)
```

- **T0, deterministic (no model).** Runs `searchSpots()` (see Phase 1). A confident name match ("Tacos Apson", "pastr") → `show_spot`. A keyword/synonym parser (`src/lib/intentRules.js`) maps "open now", protein words, "spicy/picante", "truck/stand", "handmade tortillas" and Spanish synonyms → `filterConfig` slots. If T0 covers the whole query, no LLM is called. The same code powers the free Quick Search palette.
- **T1, router.** `ChatAnthropic({ model: 'claude-haiku-4-5' }).withStructuredOutput(RouterSchema, { method: 'jsonSchema' })` (zod). It's one short call with a cached system prompt, and it returns `{intent, confidence, slots, needs_agent}`. Deterministic handlers resolve `find_spot`, `filter`, `spot_fact` and simple `compare` from the slots, using the same tool functions the agent uses, with no agent loop.
- **T2, cheap agent.** A short hand-written tool loop (`bindTools` + `ToolMessage`) on Haiku 4.5. It gets **only the tools for the routed intent** (fewer tool tokens, fewer wrong calls), a step cap of about 4, and compact tool outputs.
- **T3, escalation.** Sonnet 5.5 runs only when T2's output fails validation or the router says the query is complex (multi-constraint trail plans, "explain my taste"). There's a per-user daily escalation allowance, and escalations are tagged in traces so we can see why they happen.
- **Router roadmap.** Once LangSmith has a few hundred labeled routes (golden set plus 👍 traces), train a **local intent classifier**: embeddings + logistic regression, or a tiny fine-tuned model, exported as JSON weights or ONNX. It replaces T1's LLM call when confident, and Haiku stays as the fallback. The router eval below decides when that switch is safe.

**Model ids live in one config** (`src/lib/server/agent/models.js`, overridable by env). Evals can then run a model matrix, and swapping to another LangChain provider is a config change.

## Cost controls (built into the harness, not bolted on)
- **Prompt caching** on the system prompt and tool definitions.
- **Compact tool payloads.** Rows keyed by est_id with only the needed fields; hard `limit` on results.
- **History trimming.** Keep the last N turns plus a short running summary made by Haiku only when it's needed; `maxTokens` caps per tier.
- **Usage table.** Migration `supabase migration new ai_usage` → `<ts>_036_ai_usage.sql`. It stores `ai_usage(user_id, day, requests, input_tokens, output_tokens, escalations)` plus a SECURITY DEFINER `record_ai_usage(...)` returning today's totals, revoked from `anon`.
- **Caps.** Per-user daily **token** budget, plus a global `AI_MONTHLY_BUDGET_USD` kill switch. When it trips, the endpoint degrades to T0-only and tells the user. Applied by CI, never through the Supabase editor.
- **Measuring cost.** Every trace is tagged with tier, model and token cost, and the LangSmith dashboard shows **cost per answered query by tier**. Target: ≥60% of queries end at T0/T1, and T3 stays under 5%.

## Shared pure data model (enables server, harness and evals)
Extract the logic now inside `derived()` callbacks in `src/lib/stores.js`, which imports the browser Supabase client, into `src/lib/siteModel.js`:
- `processSites(raw)`
- `matchesFilters(site, cfg, favIds)`
- `computeSummaryStats` / `computeDistributionStats`
- `hasValidCoordinates`

Also extract `computeTasteProfile(favIds, sites, stats)` and the k-NN helpers from `src/lib/tasteProfileStore.js`. The stores keep their exports and call these functions, and the existing `stores.test.js` should keep passing unchanged. `src/lib/server/catalog.js` fetches `sites_complete` via `locals.supabase` → `processSites`, cached for about 5 minutes.

## Tools (shared by deterministic handlers and agents)
`src/lib/server/agent/tools.js`: plain functions wrapped with `tool()` + zod.
- **Read tools**:
  - `search_spots`: `searchSpots` + `matchesFilters`, with `near` via `calculateDistance()`
  - `get_spot`: hours via `getOpenStatus`/`todayHours` from `src/lib/hours.js` with an injected `now`
  - `city_stats`
  - `geocode`: `src/lib/geocoding.js`
  - `my_taste_profile`, `my_favorites`, `similar_spots`
- **Action tools**: they validate est_ids against the catalog and emit `action` events that `src/lib/agentActions.js` applies to stores.
  - `apply_filters`/`clear_filters`: `filterConfig`, with an undo snapshot
  - `show_spot`: `flyToTarget`
  - `build_trail`: `src/lib/trailStore.js`
  - `compare_spots`: `src/lib/comparisonStore.js`
  - `create_summit` / `add_favorite` (**confirm card first**): `src/lib/summit.js`, extracted from `src/routes/vote/new/+page.svelte`, and `toggleFavorite`
- **System prompts**: `src/lib/server/agent/prompt.js` exports `PROMPT_VERSION`. The rules:
  - answer only from tool results
  - cite spots by est_id
  - flag closed and pending spots
  - stay on tacos and Tucson
  - English or Spanish

## Tracing (LangSmith)
- **Env** (server-only, documented in `docs/DEPLOYMENT.md`): `ANTHROPIC_API_KEY`, `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT=cartotaco-{local|staging|production}`.
- **Metadata on each trace**:
  - `thread_id`
  - `user_hash` (never the email)
  - `env`
  - `git_sha` (`VERCEL_GIT_COMMIT_SHA`)
  - `prompt_version`
  - `tier`
  - `route_intent`
  - `router_confidence`
  - `escalation_reason`
- **Serverless flush.** Call `awaitAllCallbacks()` before the endpoint returns, because Vercel functions drop background callbacks.
- **Feedback.** 👍/👎 → `POST /api/agent/feedback` → `Client.createFeedback(runId, 'user_score')`. 👎 traces go to an annotation queue, which feeds the golden set and the router's training labels.
- **Privacy.** "Near me" coordinates are rounded to 3 decimals, and a short notice in the chat says conversations are logged.

## Evaluations (golden dataset, cost-aware)
- **Golden set**: `evals/golden/concierge.jsonl` lives in the repo and is reviewed in PRs. `evals/sync-dataset.js` upserts it to the LangSmith dataset `cartotaco-concierge-golden`.
- **Labels on each example**:
  - expected `route` (intent and acceptable tiers)
  - expected tool calls (`args_subset`)
  - must and must-not est_ids
  - required actions
  - a rubric
- **Fixtures**:
  - `evals/fixtures/sites_snapshot.json`, a frozen `sites_complete` refreshed from staging by `evals/refresh-fixture.js`
  - a fixed Tucson `now` per example
  - fixture users with known favorites
- **Coverage**: start at about 80 examples.
  - name lookups and typos
  - attribute search
  - geo
  - spot facts
  - compare
  - trail
  - Summit (must confirm)
  - recommender
  - Spanish
  - off-topic
  - hallucination traps (nonexistent, closed and pending spots; questions the data can't answer)
- **Evaluators** (`evals/evaluators.js`):
  - **Router accuracy**: intent confusion matrix and over-escalation rate (ran a costlier tier than the label allows)
  - **Deterministic**:
    - tool trajectory
    - est_id recall/precision
    - no fabricated est_ids
    - confirm-required actions never auto-applied
    - closed/pending flagged
  - **Cost and latency per example**: tokens, $ and tier, read from the run
  - **LLM-as-judge**: groundedness and rubric helpfulness on **Haiku 4.5** by default; a Sonnet judge only for the nightly/manual full run
- **Runner**: `pnpm eval` (`evals/run.js`) calls `evaluate()` from `langsmith/evaluation` with `runConcierge({ catalog, now, user, models })` as the target (local loop without a LangSmith key). The experiment name is `{git_sha}-{prompt_version}-{router}-{agent_model}`.
  - `--matrix` runs the same set across model configs (e.g. Haiku-only vs Haiku+Sonnet escalation). We then pick **the cheapest config that clears the quality bar**.
  - `--category` and `--limit` give quick, cheap local runs.
- **No-cost layer in `pnpm test`**:
  - Quick Search golden queries (`src/lib/search.test.js`)
  - `intentRules.test.js`
  - tool unit tests against the fixture
  - tier routing with scripted fake models (`concierge.test.js`); SSE action emission in phase 3
- **CI**: `.github/workflows/agent-evals.yml` runs on PRs touching `src/lib/server/agent/**`, `src/lib/siteModel.js`, `src/lib/intentRules.js` or `evals/**`, plus manual dispatch.
  - It runs the **Haiku-judged** set and writes the results to the job summary.
  - It fails when any of these happens:
    - deterministic pass rate < 90%
    - groundedness < 0.9
    - router accuracy < 90%
    - **mean cost per query rises > 20%** vs the latest `staging` baseline

## Phase 2 as built
What shipped differs from the plan above in these ways:
- **Models.** There is no Haiku 5.5. The router, T2 agent and judge run on `claude-haiku-4-5`; T3 is `claude-sonnet-5-5`. All three are in `models.js`, overridable by `AGENT_ROUTER_MODEL` / `AGENT_MODEL` / `AGENT_ESCALATION_MODEL`.
- **No LangGraph.** `createReactAgent` is deprecated (moved to the `langchain` package), and the tiers are a straight cascade, so `concierge.js` is a plain function with a ~30-line tool loop. Reach for LangGraph when phase 3/4 needs interrupts (confirm cards) or checkpointed threads.
- **Structured output uses `method: 'jsonSchema'`** (output_config), not forced tool choice, which Sonnet 5.5 rejects. Schemas avoid `minimum`/`maximum`; `toFilters()` clamps instead.
- **T2 validation.** T2 escalates on the step cap (4), an empty reply, or a reply citing an `[#est_id]` no tool returned. T3 starts fresh with every tool; T2's actions are dropped.
- **Tools in phase 2:** `search_spots`, `get_spot`, `city_stats`, `show_spot`, `apply_filters`. Deferred to phase 4 with the features that need them: `geocode` (needs Mapbox server-side), `my_taste_profile`, `my_favorites`, `similar_spots`, trail/compare/summit actions. The agent prompt says those aren't in chat yet.
- **Evals.** `pnpm eval` is a local loop with deterministic checks (tier, intent, actions, must/must-not/any ids, no fabricated ids, reply regex), an optional Haiku judge (`--judge`, evidence = the cited spots' `get_spot` data) and `--matrix` (`haiku`, `haiku+sonnet`, `sonnet-agent`). It exits 1 under the bars (deterministic/router/judge ≥ 90%). Golden set v1 has 40 examples (target 80). With `LANGSMITH_API_KEY` set, `pnpm eval` first runs `sync-dataset.js` (upsert by golden id, category as split, removed lines deleted) and then runs each config through `evaluate()` as experiment `{git_sha}-{prompt_version}-{config}`, with every check as feedback (`pass`, `tier`, `intent`, `actions`, ids, `cost_usd`, judge scores). `--local` or no key runs the same checks in a local loop.
- **Fixture** is refreshed from whatever `SUPABASE_URL`/`SUPABASE_ANON_KEY` point at (local `.env` is prod): `pnpm eval:fixture`. Golden ids must be re-checked after a refresh.
- **First results (prompt v5, 2026-10-23, LangSmith experiment `21a99b5-v5-haiku+sonnet-734e507a`):** deterministic 100%, router 100%, Haiku judge 100%, $0.0028 per query, p50 1.7 s; 23/40 queries end at T0/T1 (target ≥60%), 0 at T3. Filter-routed queries get only `apply_filters` (which also returns the matching spots): given `search_spots` too, Haiku answered from a search and left the map unfiltered. `sonnet-agent` (Sonnet at T2) scored about the same for ~12% more per query, and escalation never fired, so Haiku with Sonnet as fallback stays the default. Trail and summit get fixed T1 replies until phase 4.
- **Known data gap:** `salsa.total_num` and the named salsa booleans disagree for some spots (Taqueria el Pueblito: count 3, four named). `get_spot` returns both; the judge is told either is grounded. Worth a `data_health_report()` check.
- **Prompt caching** is marked on the agent system prompt, but the prompt + tools are likely below Haiku 4.5's minimum cacheable prefix; check `cache_read` in traces once real traffic runs.

## Phase 3 as built
- **Endpoint** `POST /api/agent` returns JSON, not SSE: p50 is ~2 s and the reply arrives whole from `runConcierge` anyway. Add streaming if T2/T3 latency starts to hurt. History is trimmed server-side to 12 plain `user`/`assistant` turns, so a client can't inject a system prompt, tools or roles.
- **Budgets.** Migration 040 `ai_usage` + `record_ai_usage()` give a per-user daily token budget (`AI_DAILY_TOKENS`, default 200k ≈ 70 T2 queries). Users can only add to their own row, so the global ceiling isn't computed from this table (any user could inflate it and trip it for everyone). Instead the production key lives in its own Anthropic workspace with a monthly **spend limit**; when Anthropic refuses a call the endpoint retries rules-only. `AI_MONTHLY_BUDGET_USD` was dropped.
- **Rules-only mode** (`runConcierge({ rulesOnly })`) answers T0 hits and otherwise says the budget is used up; no model is called.
- **Feedback** `POST /api/agent/feedback` attaches 👍/👎 as LangSmith feedback `user_score` to the run (`run_id` comes back with each reply). Set `LANGSMITH_TRACING_BACKGROUND=false` on Vercel or traces are lost when the function freezes.
- **UI** `ChatPanel.svelte` + `src/lib/agentStore.js` (actions applied in the store; no separate `agentActions.js`). Docked right, full height (the mirror of the left spot panel, so both fit); `computeMapPadding()` pads right and `--chat-panel-offset` moves the filter bar, map controls and trays aside while it's open; bottom sheet on phones. Undo covers filter changes; opening a spot is undone by closing it. No confirm cards yet: no current action needs one (they come with Summit in phase 4).
- **CI gate** `agent-evals.yml`: `pnpm eval --judge` on PRs touching the concierge (`--local`, so unmerged golden files don't rewrite the shared dataset), and a LangSmith experiment on pushes to `staging`.
- **First tuning pass (prompt v6), from real chats:** "Where can I get carnitas?" was routed as the pork filter (23 spots); dishes and protein styles now route to `recommend`, and `apply_filters` takes a `dish` so the map shows the matches. Replies leaked narration ("I'll look up…", "Let me show you these on the map:") and markdown: text alongside a lookup is dropped and `cleanReply()` strips the rest. `search_spots` reported its capped row count as the total ("4 lugares", then "the map shows 14"). Haiku said St. Mary's wasn't on CartoTaco without searching; a router-named spot's search is now seeded into T2. Golden set 43 (carnitas, a carnitas follow-up with `history`, al pastor in Spanish) plus a `no_narration` check. Result: deterministic 100%, router 100%, $0.0029 per query (down from $0.0037). The judge (Haiku) misreads evidence now and then; the one steady failure is fact-06, the salsa count data gap. Consider a Sonnet judge for the CI gate if it flakes.
- Not done: the QuickSearch → concierge hand-off ("Ask the concierge" row for uncovered queries), history summarisation (12 turns are kept verbatim), a per-user escalation allowance (escalations are counted in `ai_usage` but not capped).

## Phase 4 as built
- **Tools.** `plan_trail` (2–8 open spots, pending allowed; ordered nearest-first from the first stop, greedy, with the straight-line km and a re-plan warning past 5 km walking or 20 km cycling, after a 27 km "walk" in evals), `compare_spots` (2–3 vetted spots, returns their `get_spot` details), `start_summit` (2–6 vetted spots, optional title) and `recommend_for_me` (k-NN picks from the user's favorite spots and salsas, the same as the profile page's taste profile). `search_spots` gains `near_est_id`: closest first, with `km_away`, and no total (a total read as "35 spots in that area"). Closed spots are refused everywhere; compare and summit also refuse pending spots, as the app does.
- **Shared recommender.** The k-NN code moved out of `tasteProfileStore.js` into the pure `src/lib/recommend.js` (`recommendFor(catalog, favIds, { favouriteSalsas, k })`), so the server and evals use it. The endpoint now also loads `user_favorite_salsas`.
- **Client actions** (`applyActions` in `agentStore.js`): `plan_trail` replaces the trail and enters trail mode (the Trail tray fetches the route); `compare` refills the Compare tray; `start_summit` opens `/vote/new?ids=…&title=…`, which now prefills from the URL (dropping pending/closed ids). The user still names and creates the vote, so no confirm card was needed. On phones the chat sheet closes for the trays.
- **Routing.** No more canned trail/summit replies; `trail`, `compare` and `summit` intents get scoped tools. The agent is told whether the user is signed in and how many favorites they have (a system block after the cache breakpoint). Text written alongside a trail/compare/summit call is dropped like lookup narration, since `plan_trail` reorders the stops after the model wrote its preview.
- **Search fixes found in staging traces.** Salsas weren't indexed, so "salsa macha" found nothing: `salsaNames()` (siteModel) feeds `searchSpots` and the map's text filter. One-letter words matched as prefixes, so "U of A" matched 12 spots via "unique" and the model said "12 spots near U of A"; a finished one-letter word now matches whole words only (the concierge passes `complete: true`; QuickSearch still prefix-matches the word being typed).
- **Evals.** Golden set 50: compare (tray + "which is spiciest"), trail (bike crawl, a walking birria trail from a set start), summit (named spots, open-ended), personal picks signed in (`fan`) and out, nearest spots, a closed-spot compare trap. The judge is now Sonnet (Haiku failed replies over the salsa count despite being told not to) and sees the user's favorites and taste picks. Result (prompt v7, local): deterministic 98–100%, router 100%, Sonnet judge 82–90%, about $0.004 per query. The stricter judge catches real but small slips (calling a spot "the spiciest" when it ties, a heat level misread); see the PR for the run.
- **Not done.** `geocode` (landmarks like "U of A" need Mapbox server-side), `similar_spots` ("places like X"), and a trail that starts from the user's location.

## Phased delivery (harness before UI)
1. **T0 foundation (free, everyone).**
   - `siteModel.js` extraction
   - `src/lib/search.js`: ranked fuzzy, accent-insensitive, typo-tolerant; closed spots ranked last
   - `src/lib/intentRules.js`
   - `src/components/QuickSearch.svelte`: a ⌘K or `/` palette with results → `flyToTarget`
   - `src/lib/voice.js`: Web Speech API, mic hidden where unsupported
2. **Headless harness and evals (no chat UI yet).**
   - `models.js`, `prompt.js`, `tools.js`, `concierge.js` (T0→T1→T2→T3)
   - catalog + fixtures, the golden set v1, evaluators, `pnpm eval` with `--matrix`
   - LangSmith tracing
   - `pnpm agent:chat`, a CLI REPL against the fixture for fast iteration
   - Exit criteria: router accuracy and quality bars met on Haiku, with cost-per-query measured.
3. **Ship the concierge.**
   - the endpoint `src/routes/api/agent/+server.js`: auth, budgets, SSE, `maxDuration`
   - the `ai_usage` migration and the feedback endpoint
   - `src/lib/agentStore.js`, `src/lib/agentActions.js`, `src/components/ChatPanel.svelte`
   - the panel is docked beside `SpotPanel` with `computeMapPadding()` in `src/lib/mapping.js` extended; it's a bottom sheet on mobile
   - an action log with Undo, spot chips, the mic, the confirm cards
   - the CI eval gate
4. **Expand the tools.** Trail, Summit, Compare, then the recommender. Each comes with its golden category and passes the eval gate before shipping.
5. **Local router classifier.** Train it from the labeled traces, A/B it against the Haiku router in evals, and switch when it's within 2 points of the Haiku router's accuracy.

## Files
- New:
  - `src/lib/{siteModel,search,intentRules,voice,agentStore,agentActions,summit}.js` (+tests)
  - `src/lib/server/catalog.js`
  - `src/lib/server/agent/{models,prompt,tools,concierge}.js` (+tests)
  - `src/routes/api/agent/+server.js`, `src/routes/api/agent/feedback/+server.js`
  - `src/components/{QuickSearch,ChatPanel}.svelte`
  - `supabase/migrations/<ts>_040_ai_usage.sql`
  - `evals/{run,evaluators,sync-dataset,refresh-fixture,chat}.js`, `evals/golden/concierge.jsonl`, `evals/fixtures/*`
  - `.github/workflows/agent-evals.yml`
- Modified:
  - `src/lib/stores.js`, `src/lib/tasteProfileStore.js`
  - `src/components/Header.svelte`
  - `src/routes/Map.svelte`, `src/lib/mapping.js`
  - `src/routes/vote/new/+page.svelte`
  - `src/lib/tourStore.js`
  - `package.json` (`eval` and `agent:chat` scripts)
  - `CLAUDE.md`, `docs/DEPLOYMENT.md`, `docs/IMPROVEMENTS.md`
- Dependencies: `@langchain/core`, `@langchain/anthropic`, `langsmith`, `zod`

## Verification
- `pnpm check`, `pnpm test` and `pnpm build`, with `stores.test.js` unchanged and passing after the extraction.
- Phase 2:
  - `pnpm eval --limit 20` → a LangSmith experiment with router, deterministic, judge and cost scores
  - `pnpm eval --matrix` → compare Haiku-only vs escalation configs on quality per dollar
  - `pnpm agent:chat` shows the tier taken for each query
- Phase 3, manual check on `pnpm dev`, driven through Playwright via the `run` skill:
  - ⌘K "pastr" flies to the spot (T0)
  - "spicy pork open now, no trucks" sets chips via T0/T1 with no agent loop (check the trace tier)
  - "3-stop bike crawl near Hotel Congress" goes through T2 and draws the trail
  - Summit shows the confirm card
  - 👎 attaches feedback in LangSmith
- Endpoint: 401 when signed out; 429 or T0-only degrade over budget; client-supplied tools/system ignored; unknown est_ids rejected.
- The migration reaches staging via PR → `staging` (previews have no DB) before end-to-end testing there.
