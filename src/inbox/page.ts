/**
 * The inbox page: one self-contained HTML document (no external assets) that
 * shows every waiting request blinded and posts the answers back to
 * serve.ts. It receives Ballots only (ballot.ts), so nothing in it can tell
 * the versions apart.
 */
import type { Ballot } from './ballot.ts';

/** JSON safe to place inside a <script> block. */
const embed = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c');

export function page(ballots: Ballot[], rater: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>判定の受付箱</title>
<style>
:root {
  --bg: #f7f6f3; --surface: #ffffff; --ink: #1d1c1a; --muted: #6b6860; --line: #dedbd3;
  --accent: #1f5fa8; --accent-ink: #ffffff; --good: #1a7a4c; --good-bg: #e3f3ea; --bad: #a8322a; --bad-bg: #f8e4e1;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #171716; --surface: #222220; --ink: #ecebe7; --muted: #9c998f; --line: #3a3936;
    --accent: #7fb1ee; --accent-ink: #10100f; --good: #6fd0a0; --good-bg: #1d3a2c; --bad: #f09a90; --bad-bg: #42231f;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 96px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.lede { color: var(--muted); margin: 0 0 24px; }
.request { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px; margin-bottom: 24px; }
.request > header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline; margin-bottom: 12px; }
.request h2 { font-size: 18px; margin: 0; }
.meta { color: var(--muted); font-size: 14px; }
.howto { color: var(--muted); font-size: 14px; margin: 0 0 16px; }
.topic { border-top: 1px solid var(--line); padding: 20px 0 4px; }
.topic h3 { font-size: 17px; margin: 0 0 12px; }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 720px) { .sides { grid-template-columns: 1fr; } }
.side h4 { margin: 0 0 6px; font-size: 14px; color: var(--muted); letter-spacing: .08em; }
ol.answers { list-style: none; margin: 0; padding: 0; }
ol.answers li { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; }
ol.answers li + li { border-top: 1px solid var(--line); }
ol.answers li.good { background: var(--good-bg); }
ol.answers li.bad { background: var(--bad-bg); }
.text { flex: 1; overflow-wrap: anywhere; }
button { font: inherit; color: inherit; cursor: pointer; }
.mark { width: 32px; height: 32px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: var(--muted); flex: none; }
.mark[aria-pressed="true"].g { background: var(--good); border-color: var(--good); color: var(--surface); }
.mark[aria-pressed="true"].b { background: var(--bad); border-color: var(--bad); color: var(--surface); }
.choices { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 8px; }
.choices button, .labels button { padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: transparent; }
.choices button[aria-pressed="true"], .labels button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
input[type="text"] { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); color: var(--ink); font: inherit; }
.submit { margin-top: 16px; padding: 10px 22px; border: 0; border-radius: 8px; background: var(--accent); color: var(--accent-ink); font-weight: 600; }
.submit:disabled { opacity: .45; cursor: not-allowed; }
.left { color: var(--muted); font-size: 14px; margin-left: 12px; }
.criterion dl { margin: 0 0 12px; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 15px; }
.criterion dt { color: var(--muted); }
.criterion dd { margin: 0; }
.items { list-style: none; margin: 0; padding: 0; }
.items li { border-top: 1px solid var(--line); padding: 12px 0; }
.items .topicline { color: var(--muted); font-size: 14px; }
.items .answer { font-size: 17px; margin: 2px 0 8px; }
.labels { display: flex; gap: 8px; flex-wrap: wrap; }
.result { border-top: 1px solid var(--line); padding-top: 12px; }
.result table { border-collapse: collapse; width: 100%; font-size: 15px; }
.result th, .result td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
.verdict { font-size: 18px; font-weight: 600; margin: 12px 0 4px; }
.error { color: var(--bad); margin-top: 8px; }
.empty { color: var(--muted); padding: 40px 0; text-align: center; }
code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .92em; }
</style>
</head>
<body>
<main>
<h1>判定の受付箱</h1>
<p class="lede">評価者: <span id="rater"></span>。どちらがどの版かは、送信したあとに表示する。</p>
<div id="requests"></div>
</main>
<script>
const BALLOTS = ${embed(ballots)};
const RATER = ${embed(rater)};

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
};

/** A row of buttons where one is pressed at a time. */
function pick(cls, options, onChange) {
  const row = el('div', { class: cls });
  for (const [value, label] of options) {
    row.append(el('button', {
      type: 'button', 'aria-pressed': 'false',
      onclick: (e) => {
        for (const b of row.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
        onChange(value);
      },
    }, label));
  }
  return row;
}

async function send(card, payload, button, show) {
  button.disabled = true;
  card.querySelector('.error')?.remove();
  try {
    const res = await fetch('/api/submit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    show(body);
  } catch (err) {
    button.disabled = false;
    card.append(el('p', { class: 'error' }, '送信できなかった: ' + err.message));
  }
}

const filesLine = (files) => el('p', { class: 'meta' }, '保存先: ', ...files.flatMap((f, i) => [i ? '、' : '', el('code', {}, f)]));

function finalCheck(b) {
  const state = Object.fromEntries(b.topics.map((t) => [t.key, { choice: null, marks: {}, comment: '' }]));
  const card = el('section', { class: 'request' });
  const button = el('button', { type: 'button', class: 'submit', disabled: '' }, '判定を送信');
  const left = el('span', { class: 'left' });
  const refresh = () => {
    const missing = b.topics.filter((t) => !state[t.key].choice).length;
    button.disabled = missing > 0;
    left.textContent = missing ? 'あと ' + missing + ' 題' : '';
  };

  card.append(
    el('header', {}, el('h2', {}, '最終チェック'), el('span', { class: 'meta' }, b.topics.length + '題 ・ 依頼 ' + b.created + ' ・ ', el('code', {}, b.id))),
    el('p', { class: 'howto' }, 'お題ごとに、セットとして面白い方を選ぶ。特に良い回答には ◎、悪い回答には × を付けられる（任意。付けなかった回答は、どちらとも判定しなかった扱いになる）。'),
  );

  for (const t of b.topics) {
    const s = state[t.key];
    const side = (name) => {
      const list = el('ol', { class: 'answers' });
      t[name].forEach((text, i) => {
        const id = name + (i + 1);
        const li = el('li');
        const toggle = (kind) => () => {
          s.marks[id] = s.marks[id] === kind ? undefined : kind;
          li.className = s.marks[id] ?? '';
          g.setAttribute('aria-pressed', String(s.marks[id] === 'good'));
          x.setAttribute('aria-pressed', String(s.marks[id] === 'bad'));
        };
        const g = el('button', { type: 'button', class: 'mark g', 'aria-pressed': 'false', 'aria-label': '良い', title: '良い', onclick: toggle('good') }, '◎');
        const x = el('button', { type: 'button', class: 'mark b', 'aria-pressed': 'false', 'aria-label': '悪い', title: '悪い', onclick: toggle('bad') }, '×');
        li.append(el('span', { class: 'text' }, text), g, x);
        list.append(li);
      });
      return el('div', { class: 'side' }, el('h4', {}, name), list);
    };
    card.append(el('div', { class: 'topic' },
      el('h3', {}, t.topic),
      el('div', { class: 'sides' }, side('A'), side('B')),
      pick('choices', [['A', 'A が面白い'], ['tie', '引き分け'], ['B', 'B が面白い'], ['skip', 'スキップ']], (v) => { s.choice = v; refresh(); }),
      el('input', { type: 'text', placeholder: 'コメント（任意）', 'aria-label': 'コメント', oninput: (e) => { s.comment = e.target.value; } }),
    ));
  }

  button.addEventListener('click', () => {
    const topics = Object.fromEntries(b.topics.map((t) => {
      const s = state[t.key];
      const marked = (kind) => Object.keys(s.marks).filter((k) => s.marks[k] === kind);
      return [t.key, { choice: s.choice, good: marked('good'), bad: marked('bad'), ...(s.comment.trim() ? { comment: s.comment.trim() } : {}) }];
    }));
    send(card, { id: b.id, kind: 'final-check', topics }, button, (r) => {
      const VERSION = { candidate: '変更後', baseline: '変更前' };
      const HUMAN = { candidate: '変更後を選んだ', baseline: '変更前を選んだ', tie: '引き分け', skip: 'スキップ' };
      const rows = r.reveal.map((x) => el('tr', {}, el('td', {}, x.topic), el('td', {}, VERSION[x.A]), el('td', {}, VERSION[x.B]), el('td', {}, HUMAN[x.human])));
      const t = r.tally;
      card.replaceChildren(
        el('header', {}, el('h2', {}, '最終チェック ・ 記録した'), el('span', { class: 'meta' }, el('code', {}, b.id))),
        el('p', {}, r.description),
        el('div', { class: 'result' },
          el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'お題'), el('th', {}, 'A'), el('th', {}, 'B'), el('th', {}, '判定'))), el('tbody', {}, ...rows)),
          el('p', { class: 'verdict' }, r.rule ? '採否の規則: ' + r.ruleLabel : '判定した題がない'),
          el('p', { class: 'meta' }, '変更後の版から見て 勝ち ' + t.win + '・引き分け ' + t.tie + '・負け ' + t.loss + (t.skipped ? '・スキップ ' + t.skipped : '') + '。負けが0なら採用可、負けがあれば台帳に戻す。'),
          el('p', { class: 'meta' }, '台帳: ', el('code', {}, r.ledger), ' ・ 変更後: ' + r.candidate + ' ・ 変更前: ' + r.baseline),
          filesLine(r.files),
        ),
      );
    });
  });
  card.append(el('div', {}, button, left));
  refresh();
  return card;
}

function criterion(b) {
  const labels = b.items.map(() => null);
  const card = el('section', { class: 'request criterion' });
  const button = el('button', { type: 'button', class: 'submit', disabled: '' }, '回答を送信');
  const left = el('span', { class: 'left' });
  const refresh = () => {
    const missing = labels.filter((l) => !l).length;
    button.disabled = missing > 0;
    left.textContent = missing ? 'あと ' + missing + ' 本' : '';
  };
  const list = el('ul', { class: 'items' });
  b.items.forEach((it, i) => {
    list.append(el('li', {},
      el('div', { class: 'topicline' }, 'お題: ' + it.topic),
      el('div', { class: 'answer' }, it.answer),
      pick('labels', [['yes', 'はい'], ['no', 'いいえ'], ['unsure', 'どちらとも']], (v) => { labels[i] = v; refresh(); }),
    ));
  });
  card.append(
    el('header', {}, el('h2', {}, '狙いの質問の抜き取り確認'), el('span', { class: 'meta' }, b.items.length + '本 ・ 依頼 ' + b.created + ' ・ ', el('code', {}, b.id))),
    el('dl', {}, el('dt', {}, '質問'), el('dd', {}, b.criterion.question), el('dt', {}, 'はい'), el('dd', {}, b.criterion.true), el('dt', {}, 'いいえ'), el('dd', {}, b.criterion.false)),
    el('p', { class: 'howto' }, '回答1本ずつ、この質問に答える。面白いかどうかは問わない。'),
    list,
  );
  button.addEventListener('click', () => {
    send(card, { id: b.id, kind: 'criterion', labels }, button, (r) => {
      const a = r.agreement;
      card.replaceChildren(
        el('header', {}, el('h2', {}, '抜き取り確認 ・ 記録した'), el('span', { class: 'meta' }, el('code', {}, b.id))),
        el('div', { class: 'result' },
          el('p', { class: 'verdict' }, '判定器と一致: ' + a.agree + ' / ' + a.judged + ' 本'),
          el('p', { class: 'meta' }, '「どちらとも」は ' + a.unsure + ' 本。食い違った回答は、保存先のログの表で見られる。'),
          filesLine(r.files),
        ),
      );
    });
  });
  card.append(el('div', {}, button, left));
  refresh();
  return card;
}

document.getElementById('rater').textContent = RATER;
const root = document.getElementById('requests');
if (!BALLOTS.length) root.append(el('p', { class: 'empty' }, '判定待ちの依頼はない。'));
for (const b of BALLOTS) root.append(b.kind === 'final-check' ? finalCheck(b) : criterion(b));
</script>
</body>
</html>
`;
}
