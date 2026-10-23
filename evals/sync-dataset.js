// Upsert evals/golden/concierge.jsonl into the LangSmith dataset, so the repo
// file stays the source of truth (reviewed in PRs) and LangSmith gets a new
// dataset version on every change. Examples are matched by their golden id;
// ones removed from the file are deleted from the dataset.
//
//   node --env-file=.env evals/sync-dataset.js      (pnpm eval runs it first)
import { readFileSync } from 'node:fs';
import { Client } from 'langsmith';

export const DATASET = process.env.LANGSMITH_DATASET || 'cartotaco-concierge-golden';

export function readGolden() {
  return readFileSync(new URL('./golden/concierge.jsonl', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// One golden line → a LangSmith example. The category doubles as the split,
// so `--category` and the LangSmith UI can both slice by it.
const toExample = (ex) => ({
  inputs: { query: ex.query, user: ex.user || 'anon', ...(ex.now ? { now: ex.now } : {}) },
  outputs: { expect: ex.expect, ...(ex.rubric ? { rubric: ex.rubric } : {}) },
  metadata: { golden_id: ex.id, category: ex.category },
  split: ex.category
});

// LangSmith stores JSON with its keys reordered, so compare with keys sorted
const sorted = (v) =>
  Array.isArray(v) ? v.map(sorted)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
      : v;
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

export async function syncDataset(client = new Client()) {
  const dataset = (await client.hasDataset({ datasetName: DATASET }))
    ? await client.readDataset({ datasetName: DATASET })
    : await client.createDataset(DATASET, { description: 'CartoTaco concierge golden set (evals/golden/concierge.jsonl)' });

  const existing = new Map();
  for await (const ex of client.listExamples({ datasetId: dataset.id })) {
    existing.set(ex.metadata?.golden_id, ex);
  }

  const creates = [];
  const updates = [];
  for (const golden of readGolden()) {
    const want = toExample(golden);
    const have = existing.get(golden.id);
    existing.delete(golden.id);
    if (!have) creates.push({ ...want, dataset_id: dataset.id });
    else if (!same(have.inputs, want.inputs) || !same(have.outputs, want.outputs) || !same(have.metadata?.category, golden.category)) {
      updates.push({ id: have.id, ...want });
    }
  }
  const deletes = [...existing.values()].map((ex) => ex.id);

  if (creates.length) await client.createExamples(creates);
  if (updates.length) await client.updateExamples(updates);
  if (deletes.length) await client.deleteExamples(deletes);
  console.log(`Dataset ${DATASET}: ${creates.length} added, ${updates.length} updated, ${deletes.length} removed`);
  return dataset;
}

if (import.meta.url === `file://${process.argv[1]}`) await syncDataset();
