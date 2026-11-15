/**
 * The inbox: a local page where the human works through every waiting
 * request (data/inbox/README.md).
 *
 *   npm run inbox [-- --port 4173] [--rater repo-owner]
 *
 * Open the printed address. Each submission is written as a human-eval
 * session (.json and .md), a final check is linked to its ledger entry, the
 * request leaves the inbox, and STATUS.md is rebuilt. Stop with Ctrl-C.
 * Listens on 127.0.0.1 only.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { HUMAN_EVALS_DIR } from '../validation/labels.ts';
import { ballot } from './ballot.ts';
import { page } from './page.ts';
import { INBOX_DIR, loadPending, requestPath } from './request.ts';
import { criterionSession, finalCheckSession, linkLedger, writeSession, type CriterionAnswer, type FinalCheckAnswer } from './session.ts';

export interface InboxOptions {
  inboxDir: string;
  evalsDir: string;
  ledgerDir: string;
  rater: string;
  /** Rebuilds STATUS.md after a submission; a test passes a no-op. */
  afterSubmit: () => void;
  /** Today's date as YYYY-MM-DD; a test fixes it. */
  today: () => string;
}

const localDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const DEFAULTS: InboxOptions = {
  inboxDir: INBOX_DIR,
  evalsDir: HUMAN_EVALS_DIR,
  ledgerDir: 'data/ledger',
  rater: 'repo-owner',
  afterSubmit: () => {
    execFileSync('node', ['src/status/status.ts'], { stdio: ['ignore', 'ignore', 'inherit'] });
  },
  today: localDate,
};

async function body(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error('request body too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Records one submission and returns what the page shows afterwards. */
export function submit(answer: FinalCheckAnswer | CriterionAnswer, options: InboxOptions): Record<string, unknown> {
  // Looked up among the waiting requests, never built into a path from what the page sent.
  const request = loadPending(options.inboxDir).find((r) => r.id === answer?.id);
  if (!request) throw new Error(`no waiting request "${String(answer?.id)}" — it may already have been judged`);
  if (request.kind !== answer.kind) throw new Error(`request "${request.id}" is a ${request.kind}, not a ${answer.kind}`);
  const meta = { date: options.today(), rater: options.rater };

  let shown: Record<string, unknown>;
  let files: string[];
  if (request.kind === 'final-check') {
    const result = finalCheckSession(request, answer as FinalCheckAnswer, meta);
    files = writeSession(options.evalsDir, request.source, result);
    linkLedger(options.ledgerDir, request.source, request.ledger, result.comparisons, files[1]);
    shown = {
      reveal: result.reveal, tally: result.tally, rule: result.rule ?? null,
      ruleLabel: result.rule === 'adoptable' ? '採用可' : result.rule === 'return' ? '台帳に戻す' : null,
      description: request.description, ledger: request.ledger, candidate: request.candidate, baseline: request.baseline,
    };
  } else {
    const result = criterionSession(request, answer as CriterionAnswer, meta);
    files = writeSession(options.evalsDir, request.source, result);
    shown = { agreement: result.agreement };
  }
  rmSync(requestPath(options.inboxDir, request.source, request.id));
  options.afterSubmit();
  return { ...shown, files };
}

export function inboxServer(options: InboxOptions): Server {
  return createServer(async (req, res) => {
    const send = (status: number, type: string, text: string): void => {
      res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
      res.end(text);
    };
    try {
      if (req.method === 'GET' && req.url === '/') {
        send(200, 'text/html', page(loadPending(options.inboxDir).map(ballot), options.rater));
      } else if (req.method === 'POST' && req.url === '/api/submit') {
        send(200, 'application/json', JSON.stringify(submit(await body(req) as FinalCheckAnswer | CriterionAnswer, options)));
      } else {
        send(404, 'text/plain', 'not found');
      }
    } catch (error) {
      send(400, 'application/json', JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const port = Number(arg('port') ?? 4173);
  const options = { ...DEFAULTS, rater: arg('rater') ?? DEFAULTS.rater };
  const waiting = loadPending(options.inboxDir);
  inboxServer(options).listen(port, '127.0.0.1', () => {
    console.log(`判定待ち ${waiting.length}件。 http://127.0.0.1:${port}/ を開く（評価者: ${options.rater}、終了は Ctrl-C）`);
  });
}
