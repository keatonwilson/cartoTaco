// A REPL against the fixture for iterating on the concierge.
//
//   pnpm agent:chat              signed out
//   pnpm agent:chat --fan        signed in with favorites 4, 8, 38
//
// Prints the tier, route, actions and cost under each reply.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { processSites } from '../src/lib/siteModel.js';
import { runConcierge } from '../src/lib/server/agent/concierge.js';

const catalog = processSites(JSON.parse(readFileSync(new URL('./fixtures/sites_snapshot.json', import.meta.url))));
const user = process.argv.includes('--fan') ? { favoriteIds: new Set([4, 8, 38]) } : {};
const history = [];
const rl = createInterface({ input: process.stdin, output: process.stdout });

for (;;) {
  const query = (await rl.question('\n🌮 ')).trim();
  if (!query) continue;
  if (query === 'exit' || query === 'quit') break;
  const r = await runConcierge({ query, history, catalog, user });
  console.log(r.reply);
  const route = r.route ? ` ${r.route.intent} (${r.route.confidence})` : '';
  console.log(`  ↳ ${r.tier}${route}${r.escalation_reason ? ` escalated: ${r.escalation_reason}` : ''} · $${r.cost.toFixed(5)}`);
  for (const a of r.actions) console.log(`  ↳ action ${JSON.stringify(a)}`);
  history.push({ role: 'user', content: query }, { role: 'assistant', content: r.reply });
}
rl.close();
