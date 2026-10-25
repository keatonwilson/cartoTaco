// Run the concierge golden set against the frozen fixture.
//
//   pnpm eval                      default models, every example
//   pnpm eval --limit 10           first 10
//   pnpm eval --category trap      one category
//   pnpm eval --judge              add the Haiku rubric/groundedness judge
//   pnpm eval --matrix             every config in CONFIGS, side by side
//   pnpm eval --local              skip LangSmith even when a key is set
//
// Needs ANTHROPIC_API_KEY. With LANGSMITH_API_KEY set, it first syncs the
// golden file to the LangSmith dataset (sync-dataset.js), then runs each
// config as a LangSmith experiment with the checks below as feedback.
// Without it, the same checks run in a local loop. Either way the summary
// prints here and lands in evals/results/<config>.json, and the run exits 1
// when a quality bar is missed. An example that fails is run twice more and
// counts as passing only if both retries pass (2 of 3), so one stochastic
// miss doesn't sink the bar but a real regression still does.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { Client } from 'langsmith';
import { evaluate } from 'langsmith/evaluation';
import { z } from 'zod';
import { processSites } from '../src/lib/siteModel.js';
import { recommendFor } from '../src/lib/recommend.js';
import { runConcierge } from '../src/lib/server/agent/concierge.js';
import { makeTools } from '../src/lib/server/agent/tools.js';
import { DEFAULT_MODELS, chatModel, callCost } from '../src/lib/server/agent/models.js';
import { PROMPT_VERSION } from '../src/lib/server/agent/prompt.js';
import { DATASET, readGolden, syncDataset } from './sync-dataset.js';

const CONFIGS = {
  'haiku': { models: DEFAULT_MODELS, allowEscalation: false },
  'haiku+sonnet': { models: DEFAULT_MODELS, allowEscalation: true },
  'sonnet-agent': { models: { ...DEFAULT_MODELS, agent: DEFAULT_MODELS.escalation }, allowEscalation: false }
};
const BARS = { deterministic: 0.9, router: 0.9, judge: 0.9 };
const RETRIES = 2;

// A Friday at 7 PM in Tucson, unless an example sets its own
const DEFAULT_NOW = '2026-10-24T02:00:00Z';
const USERS = { anon: {}, fan: { favoriteIds: new Set([4, 8, 38]) } };

const { values: opts } = parseArgs({
  options: {
    limit: { type: 'string' },
    category: { type: 'string' },
    config: { type: 'string', default: 'haiku+sonnet' },
    matrix: { type: 'boolean' },
    judge: { type: 'boolean' },
    local: { type: 'boolean' }
  }
});

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const catalog = processSites(JSON.parse(read('./fixtures/sites_snapshot.json')));
const known = new Set(catalog.map((s) => s.est_id));
let examples = readGolden();
if (opts.category) examples = examples.filter((e) => e.category === opts.category);
if (opts.limit) examples = examples.slice(0, Number(opts.limit));

// Does `actual` contain everything in `expected`? (objects compared key by key)
const subset = (expected, actual) =>
  expected && typeof expected === 'object'
    ? actual != null && Object.entries(expected).every(([k, v]) => subset(v, actual[k]))
    : expected === actual;

/** Deterministic checks: name → pass/fail, or null when the example doesn't test it. */
function check(ex, r) {
  const e = ex.expect;
  const cited = [...r.reply.matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1]));
  const mentioned = new Set([...cited, ...r.actions.map((a) => a.est_id).filter(Boolean)]);
  return {
    tier: e.tiers.includes(r.tier),
    intent: e.intent && r.route ? [].concat(e.intent).includes(r.route.intent) : null,
    actions: e.actions
      ? (e.actions.length === 0 ? r.actions.length === 0 : e.actions.every((a) => r.actions.some((b) => subset(a, b))))
      : null,
    must_ids: e.must_ids ? e.must_ids.every((id) => mentioned.has(id)) : null,
    must_any_ids: e.must_any_ids ? e.must_any_ids.some((id) => mentioned.has(id)) : null,
    must_not_ids: e.must_not_ids ? !e.must_not_ids.some((id) => mentioned.has(id)) : null,
    no_fabricated: cited.every((id) => known.has(id)),
    // Sentence-initial only: "Let me show you…" is narration, "…and I'll search for more" is an offer
    no_narration: !/(?:^|[.!?]\s+)(let me|I'?ll|I will) (show|check|look|pull|get|open|filter|put|update|build|plan|search)\b|\*\*/i.test(r.reply),
    reply: e.reply_matches ? new RegExp(e.reply_matches, 'i').test(r.reply) : null
  };
}

// reason comes first so the judge reasons before it rules; with it last, the
// verdict sometimes contradicted its own reasoning ("should count as grounded" → false)
const Verdict = z.object({
  reason: z.string(),
  grounded: z.boolean().describe('Every fact in the reply is supported by the evidence'),
  follows_rubric: z.boolean()
});

/**
 * Sonnet judges the reply against the rubric, with the cited spots' data as
 * evidence. (A Haiku judge failed replies over the salsa count despite being
 * told not to, enough to sink the bar on its own.)
 */
async function judge(ex, r, now) {
  const { fns } = makeTools({ catalog, now });
  const ids = new Set([...r.reply.matchAll(/\[#(\d+)\]/g)].map((m) => Number(m[1])));
  for (const a of r.actions) if (a.est_id) ids.add(a.est_id);
  const evidence = {
    city: fns.city_stats(),
    spots: [...ids].filter((id) => known.has(id)).map((id) => fns.get_spot({ est_id: id })),
    // recommend_for_me works from these
    user_favorites: USERS[ex.user ?? 'anon'].favoriteIds
      ? [...USERS[ex.user].favoriteIds].map((id) => fns.get_spot({ est_id: id }).name)
      : 'not signed in',
    taste_picks: USERS[ex.user ?? 'anon'].favoriteIds
      ? recommendFor(catalog, USERS[ex.user].favoriteIds).map((s) => `${s.name}: ${s.similarity}% like their favorites`)
      : null
  };
  const model = chatModel(DEFAULT_MODELS.escalation, { maxTokens: 1024 })
    .withStructuredOutput(Verdict, { name: 'verdict', method: 'jsonSchema', includeRaw: true });
  const { raw, parsed } = await model.invoke([
    ['system', 'You grade replies from a taco-spot assistant for Tucson. Judge only what the reply says. In the evidence, `salsas` is the recorded salsa count and `salsa_lineup` lists only the named ones, so the two can differ (a known data gap). A reply using either number is grounded; never fail a reply over the salsa count, and judge the rest of it on its own. The evidence holds only the spots the reply cites; a total like "14 spots serve al pastor" comes from a search not shown here, so don\'t fail a reply over a count of matches, nor over distances in km or a trail\'s stop order (also from tools not shown). A pending spot may have some details (address, hours, a description) and still be unverified; saying details may be missing is correct for it. Set grounded to false only for a claim the evidence contradicts or has nothing behind; loose but fair wording ("milder", "traditional", "great salsas") is not a failure.'],
    ['user', `User asked: ${ex.query}\n\nReply: ${r.reply}\n\nActions taken: ${JSON.stringify(r.actions)}\n\nEvidence (the app's data):\n${JSON.stringify(evidence)}\n\nRubric: ${ex.rubric}`]
  ]);
  const cost = callCost(DEFAULT_MODELS.escalation, raw.usage_metadata);
  return parsed ? { ...parsed, cost } : { grounded: false, follows_rubric: false, reason: 'judge returned no verdict', cost };
}

/** Score one result and print a line for it. */
async function scoreRow(ex, r, ms) {
  const now = new Date(ex.now || DEFAULT_NOW);
  const checks = check(ex, r);
  const verdict = opts.judge && ex.rubric ? await judge(ex, r, now) : null;
  const failed = Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k);
  const judged = verdict ? ` judge:${verdict.grounded && verdict.follows_rubric ? 'ok' : 'FAIL'}` : '';
  console.log(`${failed.length ? '✗' : '✓'} ${ex.id.padEnd(10)} ${r.tier} $${r.cost.toFixed(5)}${judged}${failed.length ? '  failed: ' + failed.join(', ') : ''}`);
  if (failed.length || (verdict && !(verdict.grounded && verdict.follows_rubric))) {
    console.log(`    "${ex.query}" → ${r.reply}${verdict ? `\n    judge: ${verdict.reason}` : ''}`);
  }
  return {
    id: ex.id, category: ex.category, query: ex.query, tier: r.tier, intent: r.route?.intent ?? null,
    escalation_reason: r.escalation_reason, reply: r.reply, actions: r.actions,
    cost: r.cost, ms, checks, verdict
  };
}

const errorRow = (ex, err) => {
  console.log(`✗ ${ex.id} ERROR ${String(err).split('\n')[0]}`);
  return { id: ex.id, category: ex.category, error: String(err), checks: { ran: false } };
};

const target = (config) => ({ query, history = [], user = 'anon', now }) =>
  runConcierge({ query, history, catalog, now: new Date(now || DEFAULT_NOW), user: USERS[user], ...config });

async function runLocal(config) {
  const rows = [];
  // ponytail: 4 at a time, a fixed pool; raise it if the rate limit allows
  const queue = [...examples];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let ex; (ex = queue.shift());) {
      const start = Date.now();
      try {
        const r = await target(config)({ query: ex.query, history: ex.history, user: ex.user, now: ex.now });
        rows.push(await scoreRow(ex, r, Date.now() - start));
      } catch (err) {
        rows.push(errorRow(ex, err.message));
      }
    }
  }));
  return rows;
}

async function runLangSmith(name, config, client) {
  const ids = new Set(examples.map((e) => e.id));
  const data = [];
  for await (const ex of client.listExamples({ datasetName: DATASET })) {
    if (ids.has(ex.metadata?.golden_id)) data.push(ex);
  }
  const rows = [];
  const gitSha = process.env.GITHUB_SHA?.slice(0, 7) || execSync('git rev-parse --short HEAD').toString().trim();

  // The checks become per-example feedback on the experiment
  const scorer = async ({ run, example, inputs, outputs, referenceOutputs }) => {
    const ex = { id: example.metadata.golden_id, category: example.metadata.category, ...inputs, ...referenceOutputs };
    if (!outputs?.tier) {
      rows.push(errorRow(ex, run.error || 'no output'));
      return { results: [{ key: 'pass', score: 0 }] };
    }
    const ms = run.end_time && run.start_time ? new Date(run.end_time) - new Date(run.start_time) : 0;
    const row = await scoreRow(ex, outputs, ms);
    rows.push(row);
    const results = Object.entries(row.checks)
      .filter(([, v]) => v != null)
      .map(([key, v]) => ({ key, score: v ? 1 : 0 }));
    results.push(
      { key: 'pass', score: Object.values(row.checks).includes(false) ? 0 : 1 },
      { key: 'cost_usd', score: outputs.cost },
      { key: 'tier', value: outputs.tier }
    );
    if (row.verdict) {
      results.push(
        { key: 'grounded', score: row.verdict.grounded ? 1 : 0, comment: row.verdict.reason },
        { key: 'follows_rubric', score: row.verdict.follows_rubric ? 1 : 0, comment: row.verdict.reason }
      );
    }
    return { results };
  };

  const experiment = await evaluate(target(config), {
    data,
    evaluators: [scorer],
    client,
    experimentPrefix: `${gitSha}-${PROMPT_VERSION}-${name}`,
    metadata: { config: name, prompt_version: PROMPT_VERSION, git_sha: gitSha, ...config.models, escalation: config.allowEscalation },
    maxConcurrency: 4
  });
  console.log(`LangSmith experiment: ${experiment.experimentName}`);
  return rows;
}

const failed = (r) =>
  Object.values(r.checks).includes(false) || (r.verdict && !(r.verdict.grounded && r.verdict.follows_rubric));

/** Re-run failed examples; one that passes every retry replaces its row, marked flaky. */
async function retryFailures(rows, config) {
  for (const [i, row] of rows.entries()) {
    if (!failed(row)) continue;
    const ex = examples.find((e) => e.id === row.id);
    let last;
    for (let n = 0; n < RETRIES; n++) {
      const start = Date.now();
      try {
        last = await scoreRow(ex, await target(config)(ex), Date.now() - start);
      } catch (err) {
        last = errorRow(ex, err.message);
      }
      if (failed(last)) break;
    }
    if (!failed(last)) rows[i] = { ...last, flaky: true };
    console.log(`↻ ${row.id.padEnd(10)} ${failed(last) ? 'failed again: real failure' : `passed ${RETRIES}/${RETRIES} retries: flaky`}`);
  }
}

async function runConfig(name, config, client) {
  const rows = client ? await runLangSmith(name, config, client) : await runLocal(config);
  if (rows.some(failed)) {
    console.log('\n── retrying failures ──');
    await retryFailures(rows, config);
  }
  const ok = rows.filter((r) => !Object.values(r.checks).includes(false));
  const routed = rows.filter((r) => r.checks.intent != null);
  const judged = rows.filter((r) => r.verdict);
  const tiers = {};
  for (const r of rows) tiers[r.tier ?? 'error'] = (tiers[r.tier ?? 'error'] || 0) + 1;
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  const summary = {
    config: name, prompt_version: PROMPT_VERSION, models: config.models, examples: rows.length,
    deterministic: ok.length / rows.length,
    flaky: rows.filter((r) => r.flaky).map((r) => r.id),
    router: routed.length ? routed.filter((r) => r.checks.intent).length / routed.length : null,
    judge: judged.length ? judged.filter((r) => r.verdict.grounded && r.verdict.follows_rubric).length / judged.length : null,
    tiers,
    mean_cost: sum(rows.map((r) => r.cost || 0)) / rows.length,
    judge_cost: sum(judged.map((r) => r.verdict.cost)),
    p50_ms: rows.map((r) => r.ms || 0).sort((a, b) => a - b)[Math.floor(rows.length / 2)]
  };
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`./results/${name}.json`, import.meta.url), JSON.stringify({ summary, rows }, null, 2));
  return summary;
}

const names = opts.matrix ? Object.keys(CONFIGS) : [opts.config];
const client = process.env.LANGSMITH_API_KEY && !opts.local ? new Client() : null;
if (client) await syncDataset(client);
const summaries = [];
for (const name of names) {
  if (!CONFIGS[name]) throw new Error(`Unknown config ${name}. One of: ${Object.keys(CONFIGS).join(', ')}`);
  console.log(`\n── ${name} (${examples.length} examples) ──`);
  summaries.push(await runConfig(name, CONFIGS[name], client));
}

const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
console.log('\nconfig         determ.  router  judge   $/query    p50     tiers');
for (const s of summaries) {
  console.log(`${s.config.padEnd(14)} ${pct(s.deterministic).padEnd(8)} ${pct(s.router).padEnd(7)} ${pct(s.judge).padEnd(7)} $${s.mean_cost.toFixed(5).padEnd(9)} ${String(s.p50_ms).padStart(5)}ms  ${JSON.stringify(s.tiers)}`);
}
for (const s of summaries) if (s.flaky.length) console.log(`${s.config}: passed on retry (flaky): ${s.flaky.join(', ')}`);
const missed = summaries.some((s) => Object.entries(BARS).some(([k, bar]) => s[k] != null && s[k] < bar));
process.exitCode = missed ? 1 : 0;
