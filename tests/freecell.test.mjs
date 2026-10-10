// Kiểm thử FreeCell. Chạy: node tests/freecell.test.mjs
import assert from 'node:assert/strict';
import * as F from '../js/games/freecell/logic.js';
import { createSession, commit, undo, restart, serializeSession, restoreSession } from '../js/cards/session.js';
import { verifyPiles, cloneState, top, cardOf, isRed } from '../js/cards/deck.js';

function emptyState() {
  const piles = {};
  for (const p of [...F.CELLS, ...F.FOUNDATIONS, ...F.TABLEAU]) piles[p] = [];
  const up = new Proxy({}, { get: () => true }); // mọi lá đều ngửa
  return { seed: 1, options: {}, piles, up, moves: 0 };
}
const plain = (s) => ({ ...s, up: Object.fromEntries(Object.values(s.piles).flat().map((id) => [id, true])) });

// Chia bài: 8 cột (4 × 7 lá, 4 × 6 lá), tất cả ngửa, ô dự trữ và đích trống.
const g = F.newGame(9);
assert.deepEqual(F.TABLEAU.map((t) => g.piles[t].length), [7, 7, 7, 7, 6, 6, 6, 6]);
assert.ok(F.expectedIds().every((id) => g.up[id]));
assert.ok([...F.CELLS, ...F.FOUNDATIONS].every((p) => g.piles[p].length === 0));
assert.ok(verifyPiles(g.piles, F.expectedIds()));
assert.deepEqual(F.newGame(9).piles, g.piles);

// Luật cột: giảm dần, xen kẽ màu; cột trống nhận lá bất kỳ.
let s = emptyState();
s.piles.t0 = ['S9.0']; s.piles.t1 = ['H8.0']; s.piles.t2 = ['C8.0']; s.piles.t3 = ['D5.0'];
assert.ok(F.tryMove(s, { from: 't1', index: 0, to: 't0' }), '8♥ lên 9♠');
assert.equal(F.tryMove(s, { from: 't2', index: 0, to: 't0' }), null, '8♣ không lên 9♠');
assert.equal(F.tryMove(s, { from: 't3', index: 0, to: 't0' }), null, '5♦ không lên 9♠');
assert.ok(F.tryMove(s, { from: 't3', index: 0, to: 't4' }), 'cột trống nhận lá bất kỳ');

// Ô dự trữ: tối đa 1 lá; chỉ 1 lá mỗi lần.
let c = F.tryMove(s, { from: 't3', index: 0, to: 'c0' });
assert.ok(c);
assert.equal(F.tryMove(c, { from: 't2', index: 0, to: 'c0' }), null, 'ô dự trữ đã có lá');
assert.ok(F.tryMove(c, { from: 'c0', index: 0, to: 't4' }), 'lấy lá từ ô dự trữ');

// Chồng đích: cùng chất A → K; không lấy xuống lại.
s = emptyState();
s.piles.t0 = ['D1.0']; s.piles.t1 = ['D2.0']; s.piles.t2 = ['S2.0'];
assert.equal(F.tryMove(s, { from: 't1', index: 0, to: 'f0' }), null);
let f = F.tryMove(s, { from: 't0', index: 0, to: 'f0' });
assert.equal(F.tryMove(f, { from: 't2', index: 0, to: 'f0' }), null, '2♠ không lên A♦');
f = F.tryMove(f, { from: 't1', index: 0, to: 'f0' });
assert.ok(f);
assert.ok(!F.canPick(f, 'f0', 1), 'không lấy bài từ chồng đích');

// Giới hạn chuyển chuỗi: (ô trống + 1) × 2^(cột trống), không tính cột đích trống.
s = emptyState();
const run = ['S13.0', 'H12.0', 'C11.0', 'D10.0', 'S9.0', 'H8.0', 'C7.0', 'D6.0', 'S5.0', 'H4.0', 'C3.0', 'D2.0'];
s.piles.t0 = run.slice();
s.piles.t1 = ['D13.0'];
s.piles.t2 = ['H1.0']; s.piles.t3 = ['S1.0']; s.piles.t4 = ['D1.0']; s.piles.t5 = ['C1.0'];
// 4 ô trống, 2 cột trống (t6, t7): tới cột không trống = 5 × 4 = 20; tới cột trống = 5 × 2 = 10.
assert.equal(F.maxMovable(s, 't1'), 20);
assert.equal(F.maxMovable(s, 't6'), 10);
s.piles.c0 = ['H13.1']; s.piles.c1 = ['S13.1']; s.piles.c2 = ['C13.1'];
// 1 ô trống, 2 cột trống → (1+1)×4 = 8 tới cột có bài; tới cột trống: (1+1)×2 = 4.
assert.equal(F.maxMovable(s, 't1'), 8);
assert.equal(F.maxMovable(s, 't6'), 4);
// Chuỗi 4 lá (từ J♣) vào cột trống t6: đủ (giới hạn 4).
const four = F.tryMove(s, { from: 't0', index: 8, to: 't6' });
assert.ok(four, 'chuyển 4 lá vào cột trống khi giới hạn là 4');
assert.deepEqual(four.piles.t6, ['S5.0', 'H4.0', 'C3.0', 'D2.0']);
assert.equal(F.tryMove(s, { from: 't0', index: 7, to: 't6' }), null, '5 lá vào cột trống vượt giới hạn 4');
// 8 lá lên cột có lá đích phù hợp (10♥ nhận 9♠).
s.piles.t2 = ['H10.0']; s.piles.f0 = ['H1.0']; s.piles.t3 = ['S1.0'];
// Từ 9♠ (index 4) tới cuối: 8 lá → đích 10♥ (đỏ) hợp lệ.
const eight = F.tryMove(s, { from: 't0', index: 4, to: 't2' });
assert.ok(eight, '8 lá đúng giới hạn 8');
assert.equal(eight.moves, s.moves + 1, 'chuyển chuỗi tính là một nước');
assert.deepEqual(eight.piles.t2, ['H10.0', ...run.slice(4)]);
assert.ok(F.CELLS.every((x) => JSON.stringify(eight.piles[x]) === JSON.stringify(s.piles[x])), 'ô dự trữ trở về như cũ');
assert.ok(eight.piles.t6.length === 0 && eight.piles.t7.length === 0, 'cột trung gian trở về trống');
s.piles.t2 = ['C11.1']; // J♣ ← 10♦ hợp lệ: chuỗi từ 10♦ (index 3) = 9 lá > 8
assert.equal(F.tryMove(s, { from: 't0', index: 3, to: 't2' }), null, '9 lá vượt giới hạn 8');

// Các bước từng lá: mọi bước hợp lệ theo luật một lá và cho cùng kết quả.
for (let freeCells = 0; freeCells <= 4; freeCells++) {
  for (let emptyCols = 0; emptyCols <= 3; emptyCols++) {
    const st = emptyState();
    const r = ['S13.0', 'H12.0', 'C11.0', 'D10.0', 'S9.0', 'H8.0', 'C7.0', 'D6.0', 'S5.0', 'H4.0', 'C3.0', 'D2.0'];
    st.piles.t0 = r.slice();
    const fillers = ['H13.1', 'S13.1', 'C13.1', 'D13.1', 'H11.1', 'S11.1', 'D11.1'];
    for (let k = 0; k < 4 - freeCells; k++) st.piles[F.CELLS[k]] = [fillers.pop()];
    for (let k = 2 + emptyCols; k < 8; k++) st.piles[F.TABLEAU[k]] = [fillers.pop() || `S${k}.1`];
    // Lá đích ở t1 luôn nhận được lá đầu của chuỗi cần chuyển.
    const destFor = (id) => { const c = cardOf(id); return `${isRed(c.suit) ? 'S' : 'H'}${c.rank + 1}.2`; };
    const limit = F.maxMovable(st, 't1');
    assert.equal(limit, (freeCells + 1) * 2 ** emptyCols);
    const n = Math.min(limit, 11);
    st.piles.t1 = [destFor(r[12 - n])];
    const res = F.supermoveSteps(st, 't0', n, 't1');
    assert.ok(res, `chuyển ${n} lá với ${freeCells} ô, ${emptyCols} cột`);
    let sim = cloneState(st);
    for (const step of res.steps) {
      assert.equal(step.index, sim.piles[step.from].length - 1, 'mỗi bước chỉ một lá trên cùng');
      assert.ok(F.canPlace(sim, [top(sim.piles[step.from])], step.to), 'bước hợp lệ theo luật một lá');
      sim.piles[step.to].push(sim.piles[step.from].pop());
      assert.ok(F.CELLS.every((x) => sim.piles[x].length <= 1));
    }
    assert.deepEqual(sim.piles, res.state.piles);
    assert.deepEqual(sim.piles.t1, [st.piles.t1[0], ...r.slice(12 - n)]);
    assert.ok(F.tryMove(st, { from: 't0', index: 12 - n, to: 't1' }), 'nước chuyển chuỗi đúng giới hạn được chấp nhận');
    if (limit < 11) {
      const over = cloneState(st);
      over.piles.t1 = [destFor(r[12 - limit - 1])];
      assert.equal(F.tryMove(over, { from: 't0', index: 12 - limit - 1, to: 't1' }), null, `${limit + 1} lá vượt giới hạn ${limit} bị từ chối`);
      assert.equal(F.supermoveSteps(over, 't0', limit + 1, 't1'), null, 'không tách được thành các bước từng lá');
    }
  }
}

// Tự đưa lá an toàn lên đích.
s = emptyState();
s.piles.t0 = ['S1.0']; s.piles.t1 = ['S2.0', 'H1.0'];
s.piles.t2 = ['H3.0'];
let a = F.autoplay(plain(s));
assert.equal(a.piles.f0.length + a.piles.f1.length, 3, 'A♠, A♥, 2♠ tự lên đích');
assert.deepEqual(a.piles.t2, ['H3.0'], '3♥ chưa an toàn khi đen mới tới 2♠ và 0♣');

// Hoàn tác, lưu/tải, chơi lại.
const session = createSession(F, 2024, {});
const initial = JSON.stringify(session.state);
for (let i = 0; i < 30; i++) {
  const h = F.hint(session.state);
  if (!h) break;
  const next = F.tryMove(session.state, h.move);
  assert.ok(next, 'gợi ý luôn hợp lệ');
  assert.ok(verifyPiles(next.piles, F.expectedIds()));
  commit(session, next);
}
assert.ok(session.history.length > 0);
const restored = restoreSession(F, JSON.parse(JSON.stringify(serializeSession(session))));
assert.deepEqual(restored.state, session.state, 'tải lại giữ nguyên bài');
const prev = JSON.stringify(session.history.at(-1));
undo(session);
assert.equal(JSON.stringify(session.state), prev);
restart(F, session);
assert.equal(JSON.stringify(session.state), initial, 'chơi lại: cùng thứ tự chia');

// Thắng: 52 lá trên đích.
s = emptyState();
['S', 'H', 'D', 'C'].forEach((su, i) => { for (let r = 1; r <= 13; r++) s.piles[`f${i}`].push(`${su}${r}.0`); });
assert.ok(F.isWon(s));
s.piles.t0.push(s.piles.f3.pop());
assert.ok(!F.isWon(s));
assert.ok(F.isWon(F.tryMove(plain(s), { from: 't0', index: 0, to: 'f3' })));

// Gợi ý trên nhiều ván luôn là nước hợp lệ.
for (let seed = 1; seed <= 40; seed++) {
  let st = F.newGame(seed);
  for (let i = 0; i < 60; i++) {
    const h = F.hint(st);
    if (!h) break;
    const next = F.tryMove(st, h.move);
    assert.ok(next, `gợi ý hợp lệ (ván ${seed})`);
    st = F.autoplay(next);
  }
  assert.ok(verifyPiles(st.piles, F.expectedIds()));
}

console.log('✓ Tất cả kiểm thử FreeCell đều qua');

// Gợi ý không đề xuất đổi lá giữa hai ô dự trữ.
{
  const st = emptyState();
  st.piles.c0 = ['S9.0']; st.piles.t0 = ['H4.0'];
  const h = F.hint(plain(st));
  assert.ok(!h || !(h.move.from.startsWith('c') && h.move.to.startsWith('c')));
}
