# AI Concierge Plan

Status: Phase 1 (Quick Search, intent rules, voice, `siteModel.js`) shipped on this branch; Phases 2–5 planned.

## Context
We want fast natural-language and voice search in CartoTaco, plus an AI agent that drives the app: filters, map, cards, trails, Summits, comparisons and taste-profile recommendations. Constraints from the discussion:
- **Cheap models first.** Build and prove the *harness* (routing, tools, prompts, evals) on cheap models before any UI polish. Don't break the bank.
- **A router (decision) model** decides how much machinery each query needs. Most queries should never reach an agent loop.
- **LangChain.js / LangGraph**, with **LangSmith** for tracing and a **versioned golden dataset** for evals.
- Local search is free for everyone. The AI requires sign-in.

## Core design: a tiered LangGraph with the router in front
`src/lib/server/agent/graph.js` builds a LangGraph `StateGraph`. Each query takes the cheapest path that can answer it:

```
query ─▶ T0 deterministic ──hit──▶ actions + templated reply                 ($0)
            │ miss
            ▼
         T1 router (Haiku 5.5, structured output, 1 call)
            │ intent ∈ {find_spot, filter, spot_fact, compare, trail, summit, recommend, chitchat, off_topic}
            │ + parsed slots + confidence
            ├─ simple intent & confident ─▶ deterministic handler + optional 1 Haiku sentence   (~1–2 calls)
            ├─ multi-step / low confidence ─▶ T2 Haiku ReAct agent, intent-scoped tool subset
            └─ T2 fails validation (bad args, empty results, step cap) ─▶ T3 Sonnet 5.5 escalation (budgeted)
```

- **T0, deterministic (no model).** Runs `searchSpots()` (see Phase 1). A confident name match ("Tacos Apson", "pastr") → `show_spot`. A keyword/synonym parser (`src/lib/intentRules.js`) maps "open now", protein words, "spicy/picante", "truck/stand", "handmade tortillas" and Spanish synonyms → `filterConfig` slots. If T0 covers the whole query, no LLM is called. The same code powers the free Quick Search palette.
- **T1, router.** `ChatAnthropic({ model: 'claude-haiku-5-5' }).withStructuredOutput(RouterSchema)` (zod). It's one short call with a cached system prompt, and it returns `{intent, confidence, slots, needs_agent}`. Deterministic handlers resolve `find_spot`, `filter`, `spot_fact` and simple `compare` from the slots, using the same tool functions the agent uses, with no agent loop.
- **T2, cheap agent.** `createReactAgent` on Haiku 5.5. It gets **only the tools for the routed intent** (fewer tool tokens, fewer wrong calls), a step cap of about 4, and compact tool outputs.
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
- **Env** (server-only, documented in `docs/DEPLOYMENT.md`): `ANTHROPIC_API_KEY`, `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT=cartotaco-concierge-{dev|staging|prod}`.
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
  - **LLM-as-judge**: groundedness and rubric helpfulness on **Haiku 5.5** by default; a Sonnet judge only for the nightly/manual full run
- **Runner**: `pnpm eval` (`evals/run.js`) calls `evaluate()` from `langsmith/evaluation` against `buildGraph({ catalog, now, user, models })`. The experiment name is `{git_sha}-{prompt_version}-{router}-{agent_model}`.
  - `--matrix` runs the same set across model configs (e.g. Haiku-only vs Haiku+Sonnet escalation). We then pick **the cheapest config that clears the quality bar**.
  - `--category` and `--limit` give quick, cheap local runs.
- **No-cost layer in `pnpm test`**:
  - Quick Search golden queries (`src/lib/search.test.js`)
  - `intentRules.test.js`
  - tool unit tests against the fixture
  - graph routing and SSE action emission with LangChain fake chat models (`FakeListChatModel`, scripted tool calls)
- **CI**: `.github/workflows/agent-evals.yml` runs on PRs touching `src/lib/server/agent/**`, `src/lib/siteModel.js`, `src/lib/intentRules.js` or `evals/**`, plus manual dispatch.
  - It runs the **Haiku-judged** set and writes the results to the job summary.
  - It fails when any of these happens:
    - deterministic pass rate < 90%
    - groundedness < 0.9
    - router accuracy < 90%
    - **mean cost per query rises > 20%** vs the latest `staging` baseline

## Phased delivery (harness before UI)
1. **T0 foundation (free, everyone).**
   - `siteModel.js` extraction
   - `src/lib/search.js`: ranked fuzzy, accent-insensitive, typo-tolerant; closed spots ranked last
   - `src/lib/intentRules.js`
   - `src/components/QuickSearch.svelte`: a ⌘K or `/` palette with results → `flyToTarget`
   - `src/lib/voice.js`: Web Speech API, mic hidden where unsupported
2. **Headless harness and evals (no chat UI yet).**
   - `models.js`, `prompt.js`, `tools.js`, `graph.js` (T0→T1→T2→T3)
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
  - `src/lib/server/agent/{models,prompt,tools,graph}.js` (+tests)
  - `src/routes/api/agent/+server.js`, `src/routes/api/agent/feedback/+server.js`
  - `src/components/{QuickSearch,ChatPanel}.svelte`
  - `supabase/migrations/<ts>_036_ai_usage.sql`
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
- Dependencies: `@langchain/core`, `@langchain/anthropic`, `@langchain/langgraph`, `langsmith`, `zod`

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
