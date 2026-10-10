// Kiểm thử Spider Solitaire. Chạy: node tests/spider.test.mjs
import assert from 'node:assert/strict';
import * as S from '../js/games/spider/logic.js';
import { createSession, commit, undo, restart, serializeSession, restoreSession } from '../js/cards/session.js';
import { verifyPiles, cardOf } from '../js/cards/deck.js';

function emptyState(suits = 4) {
  const piles = { stock: [], done: [] };
  for (const t of S.TABLEAU) piles[t] = [];
  return { seed: 1, options: { suits }, piles, up: {}, moves: 0 };
}
const faceUp = (s, list) => { for (const id of list) s.up[id] = true; return s; };
const run = (suit, from, to, deck = 0) => { const a = []; for (let r = from; r >= to; r--) a.push(`${suit}${r}.${deck}`); return a; };

// 104 lá với cả ba chế độ; ID không trùng; chia 6-6-6-6-5-5-5-5-5-5; 50 lá chia thêm; chỉ lá trên ngửa.
for (const suits of [1, 2, 4]) {
  const ids = S.expectedIds({ suits });
  assert.equal(ids.length, 104);
  assert.equal(new Set(ids).size, 104);
  assert.equal(new Set(ids.map((id) => cardOf(id).suit)).size, suits);
  for (const id of ids) assert.ok(cardOf(id));
  const g = S.newGame(5, { suits });
  assert.deepEqual(S.TABLEAU.map((t) => g.piles[t].length), [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]);
  assert.equal(g.piles.stock.length, 50);
  for (const t of S.TABLEAU) g.piles[t].forEach((id, i) => assert.equal(!!g.up[id], i === g.piles[t].length - 1));
  assert.ok(verifyPiles(g.piles, ids));
  assert.deepEqual(S.newGame(5, { suits }).piles, g.piles);
}
assert.deepEqual(S.normalizeOptions({ suits: 3 }), { suits: 1 });

// Đặt bài giảm dần bất kể chất; chỉ cầm chuỗi cùng chất.
let s = emptyState();
s.piles.t0 = ['S9.0']; s.piles.t1 = ['H8.0']; s.piles.t2 = ['S10.0', 'H9.0', 'H8.1']; s.piles.t3 = ['D10.0', 'C9.0', 'D8.0'];
s.piles.t4 = ['C5.0']; s.piles.t5 = ['D4.0'];
faceUp(s, ['S9.0', 'H8.0', 'S10.0', 'H9.0', 'H8.1', 'D10.0', 'C9.0', 'D8.0', 'C5.0', 'D4.0']);
for (const t of ['t6', 't7', 't8', 't9']) { s.piles[t] = [`C${t[1]}.1`]; faceUp(s, s.piles[t]); }
assert.ok(S.tryMove(s, { from: 't1', index: 0, to: 't0' }), '8♥ lên 9♠ (khác chất vẫn được)');
assert.equal(S.tryMove(s, { from: 't4', index: 0, to: 't0' }), null, '5♣ không lên 9♠');
assert.ok(S.canPick(s, 't2', 1), 'chuỗi 9♥-8♥ cùng chất cầm được');
assert.ok(!S.canPick(s, 't2', 0), '10♠-9♥ khác chất: không cầm cả chuỗi');
assert.ok(!S.canPick(s, 't3', 0) && !S.canPick(s, 't3', 1), 'chuỗi xen kẽ chất không cầm được');
assert.ok(S.canPick(s, 't3', 2));
const mv = S.tryMove(s, { from: 't2', index: 1, to: 't3' });
assert.equal(mv, null, '9♥ không lên 8♦');
assert.ok(S.tryMove(s, { from: 't5', index: 0, to: 't4' }), '4♦ lên 5♣');

// Cột trống nhận một lá hoặc chuỗi hợp lệ.
s.piles.t9 = [];
const toEmpty = S.tryMove(s, { from: 't2', index: 1, to: 't9' });
assert.deepEqual(toEmpty.piles.t9, ['H9.0', 'H8.1']);
assert.ok(S.tryMove(s, { from: 't4', index: 0, to: 't9' }));

// Tự lật lá úp lộ ra.
s = emptyState();
s.piles.t0 = ['H3.0', 'S5.0']; s.piles.t1 = ['S6.0'];
faceUp(s, ['S5.0', 'S6.0']);
const fl = S.tryMove(s, { from: 't0', index: 1, to: 't1' });
assert.ok(fl.up['H3.0']);

// Thu chuỗi K–A cùng chất khi nằm cuối cột (cả khi chuỗi được ghép từ nước đi).
s = emptyState();
s.piles.t0 = ['D7.1', ...run('S', 13, 2)];
s.piles.t1 = ['S1.0'];
faceUp(s, [...run('S', 13, 2), 'S1.0']);
for (const t of S.TABLEAU.slice(2)) { s.piles[t] = [`C${Number(t[1]) + 2}.1`]; faceUp(s, s.piles[t]); }
let c = S.tryMove(s, { from: 't1', index: 0, to: 't0' });
assert.equal(S.completedRuns(c), 1, 'thu một chuỗi');
assert.deepEqual(c.piles.t0, ['D7.1']);
assert.ok(c.up['D7.1'], 'lá úp dưới chuỗi được lật');
assert.deepEqual(c.piles.done, [...run('S', 13, 1)]);
// Chuỗi K–A khác chất không được thu.
s = emptyState();
s.piles.t0 = [...run('S', 13, 2), 'H1.0'];
faceUp(s, s.piles.t0);
assert.equal(S.collectRuns(s), 0);
// Cột chỉ gồm đúng một chuỗi K–A cùng chất → thu hết, cột trống.
s = emptyState();
s.piles.t0 = [...run('S', 13, 1)];
faceUp(s, s.piles.t0);
assert.equal(S.collectRuns(s), 1);
assert.equal(s.piles.t0.length, 0);

// Chia thêm: mỗi cột một lá ngửa; không chia khi còn cột trống; thu chuỗi hoàn chỉnh sau khi chia.
const g = S.newGame(11, { suits: 1 });
const d = S.dealRow(g);
assert.equal(d.piles.stock.length, 40);
for (const t of S.TABLEAU) {
  assert.equal(d.piles[t].length, g.piles[t].length + 1);
  assert.ok(d.up[d.piles[t].at(-1)], 'lá chia thêm được ngửa');
}
assert.equal(d.moves, 1);
const withEmpty = JSON.parse(JSON.stringify(g));
withEmpty.piles.stock.push(...withEmpty.piles.t9.splice(0));
assert.equal(typeof S.dealRow(withEmpty), 'string', 'từ chối chia khi còn cột trống');
let e = g;
for (let k = 0; k < 5; k++) e = S.dealRow(e);
assert.equal(e.piles.stock.length, 0);
assert.equal(S.dealRow(e), null, 'hết bài để chia');
s = emptyState();
s.piles.t0 = run('S', 13, 2);
faceUp(s, s.piles.t0);
for (const t of S.TABLEAU.slice(1)) { s.piles[t] = [`H${t[1]}.0`]; faceUp(s, s.piles[t]); }
s.piles.stock = ['H10.1', 'H11.1', 'H12.1', 'H13.1', 'D2.1', 'D3.1', 'D4.1', 'D5.1', 'D6.1', 'S1.0'];
const dc = S.dealRow(s);
assert.equal(S.completedRuns(dc), 1, 'A♠ chia lên cột 1 hoàn thành chuỗi và được thu');

// Thắng khi thu đủ 8 chuỗi.
s = emptyState(1);
for (let k = 0; k < 7; k++) s.piles.done.push(...run('S', 13, 1, k));
s.piles.t0 = run('S', 13, 2, 7); s.piles.t1 = ['S1.7'];
faceUp(s, [...s.piles.t0, 'S1.7']);
assert.ok(!S.isWon(s));
const w = S.tryMove(s, { from: 't1', index: 0, to: 't0' });
assert.ok(S.isWon(w));
assert.equal(S.completedRuns(w), 8);
assert.ok(verifyPiles(w.piles, S.expectedIds({ suits: 1 })));

// Hoàn tác, lưu/tải, chơi lại; gợi ý luôn hợp lệ.
for (const suits of [1, 2, 4]) {
  const session = createSession(S, 99 + suits, { suits });
  const initial = JSON.stringify(session.state);
  for (let i = 0; i < 80; i++) {
    const h = S.hint(session.state);
    if (!h) break;
    const next = h.move.draw ? S.dealRow(session.state) : S.tryMove(session.state, h.move);
    assert.ok(next && typeof next === 'object', `gợi ý hợp lệ (${suits} chất)`);
    assert.ok(verifyPiles(next.piles, S.expectedIds({ suits })));
    commit(session, next);
  }
  const restored = restoreSession(S, JSON.parse(JSON.stringify(serializeSession(session))));
  assert.deepEqual(restored.state, session.state, 'tải lại giữ nguyên bài');
  const prev = JSON.stringify(session.history.at(-1));
  undo(session);
  assert.equal(JSON.stringify(session.state), prev, 'hoàn tác (kể cả lần chia thêm / thu chuỗi)');
  restart(S, session);
  assert.equal(JSON.stringify(session.state), initial);
  const bad = serializeSession(session);
  bad.options = { suits: suits === 2 ? 4 : 2 };
  assert.equal(restoreSession(S, bad), null, 'bản lưu có bài không khớp chế độ bị từ chối');
}

// Hoàn tác một lần thu chuỗi khôi phục chuỗi về cột.
{
  const st = emptyState();
  st.piles.t0 = run('S', 13, 2); st.piles.t1 = ['S1.0'];
  faceUp(st, [...st.piles.t0, 'S1.0']);
  for (const t of S.TABLEAU.slice(2)) { st.piles[t] = [`C${Number(t[1]) + 2}.1`]; faceUp(st, st.piles[t]); }
  const ids = Object.values(st.piles).flat();
  const rules = { ...S, expectedIds: () => ids, newGame: () => st };
  const session = createSession(rules, 1, { suits: 4 });
  commit(session, S.tryMove(session.state, { from: 't1', index: 0, to: 't0' }));
  assert.equal(S.completedRuns(session.state), 1);
  undo(session);
  assert.equal(S.completedRuns(session.state), 0);
  assert.equal(session.state.piles.t0.length, 12);
  assert.deepEqual(session.state.piles.t1, ['S1.0']);
}

console.log('✓ Tất cả kiểm thử Spider đều qua');
