/**
 * Puts a request into the inbox for the human to judge later.
 *
 *   npm run inbox:add -- <request.json>
 *
 * The file is what the generation agent wrote (format: data/inbox/README.md).
 * It is checked, given a seed (which fixes the blinding before anyone looks),
 * and stored as data/inbox/<source>/<id>.json. A final check must name a
 * ledger entry, so nothing is judged without a recorded hypothesis.
 * STATUS.md is rebuilt so the request shows under 判定待ち.
 */
import { randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadLedger } from '../status/ledger.ts';
import { loadLabels } from '../validation/labels.ts';
import { checkRequest, storeRequest, type InboxRequest } from './request.ts';

const path = process.argv[2];
if (!path) {
  console.error('usage: node src/inbox/add.ts <request.json>');
  process.exit(1);
}

try {
  const request = { ...checkRequest(JSON.parse(readFileSync(path, 'utf8'))), seed: randomInt(2 ** 31) } as InboxRequest;
  const labels = loadLabels(request.source);
  if (labels.sessions.some((s) => s.request?.id === request.id)) throw new Error(`a session for request "${request.id}" already exists — pick another id`);
  if (request.ledger !== undefined) {
    const entry = loadLedger(labels, request.source).find((e) => e.id === request.ledger);
    if (!entry) throw new Error(`data/ledger/${request.source}.json has no entry "${request.ledger}" — add the hypothesis first (data/ledger/README.md)`);
    if (request.kind === 'final-check' && entry.kind !== 'change') throw new Error(`ledger entry "${request.ledger}" is not a "change" entry`);
  }
  const stored = storeRequest(request);
  execFileSync('node', ['src/status/status.ts'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const size = request.kind === 'final-check' ? `${request.topics.length} お題` : `${request.items.length} answers`;
  console.log(`-> ${stored} (${request.kind}, ${size}). The human judges it with \`npm run inbox\`; do not wait for it.`);
} catch (error) {
  console.error(`inbox:add failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
