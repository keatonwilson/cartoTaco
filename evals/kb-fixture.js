// cocina's published cards as the evals see them: a pinned snapshot release,
// downloaded by `pnpm eval:kb-fixture` (the tag in package.json is the pin, so
// moving it is a deliberate PR). The file name is the version.
import { readdirSync, readFileSync } from 'node:fs';
import { parseSnapshot } from '../src/lib/kb.js';

const dir = new URL('./fixtures/', import.meta.url);
const file = readdirSync(dir).find((f) => /^kb-.+\.jsonl$/.test(f));

export const kb = file
  ? { version: file.replace(/\.jsonl$/, ''), cards: parseSnapshot(readFileSync(new URL(file, dir), 'utf8')) }
  : { version: null, cards: [] };
