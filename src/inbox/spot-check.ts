/**
 * Turns a criterion-count result into an inbox request: a sample of the
 * judged answers for the human to answer the same question on.
 *
 *   npm run inbox:spot-check -- <criterion-count output.json> <id> [--n 20] [--ledger <entry id>] [--source ogiri-ai]
 *
 * The sample leans towards the answers that decide the count: everything the
 * judge called a yes or was unsure about (probability 0.35 or more), up to
 * 60% of the sample, then answers spread evenly over the rest of the range.
 * Writes <id>.request.json next to the result and adds it to the inbox.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface Row { topic: string; answer: string; yes: number }

/** Deterministic: the same result always gives the same sample. */
export function sample(rows: Row[], n: number): Row[] {
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = `${r.topic}\u0000${r.answer}`;
    return seen.has(k) ? false : (seen.add(k), true);
  }).sort((a, b) => b.yes - a.yes);
  const near = unique.filter((r) => r.yes >= 0.35).slice(0, Math.ceil(n * 0.6));
  const rest = unique.filter((r) => !near.includes(r));
  const want = Math.min(n - near.length, rest.length);
  const spread = Array.from({ length: want }, (_, i) => rest[Math.floor((i * rest.length) / want)]);
  return [...near, ...spread];
}

if (process.argv[1]?.endsWith('spot-check.ts')) {
  const [resultPath, id] = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  if (!resultPath || !id || id.startsWith('--')) {
    console.error('usage: node src/inbox/spot-check.ts <criterion-count output.json> <id> [--n 20] [--ledger <entry id>] [--source ogiri-ai]');
    process.exit(1);
  }
  const result = JSON.parse(readFileSync(resultPath, 'utf8')) as { criterion: Record<string, string>; rows: Row[] };
  const d = new Date();
  const request = {
    id,
    kind: 'criterion',
    source: arg('source') ?? 'ogiri-ai',
    created: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    ...(arg('ledger') ? { ledger: arg('ledger') } : {}),
    criterion: result.criterion,
    items: sample(result.rows, Number(arg('n') ?? 20)).map((r) => ({ topic: r.topic, answer: r.answer, probability: r.yes })),
  };
  const out = join(dirname(resultPath), `${id}.request.json`);
  writeFileSync(out, `${JSON.stringify(request, null, 2)}\n`);
  execFileSync('node', ['src/inbox/add.ts', out], { stdio: 'inherit' });
}
