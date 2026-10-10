// Kiểm thử Klondike. Chạy: node tests/klondike.test.mjs
import assert from 'node:assert/strict';
import * as K from '../js/games/klondike/logic.js';
import { createSession, commit, undo, restart, serializeSession, restoreSession } from '../js/cards/session.js';
import { verifyPiles, cardOf } from '../js/cards/deck.js';

function emptyState(draw = 1) {
  const piles = { stock: [], waste: [] };
  for (const f of K.FOUNDATIONS) piles[f] = [];
  for (const t of K.TABLEAU) piles[t] = [];
  return { seed: 1, options: { draw }, piles, up: {}, moves: 0, passes: 0 };
}
const faceUp = (s, list) => { for (const id of list) s.up[id] = true; return s; };

// Chia bài ban đầu: 1–7 lá mỗi cột, chỉ lá trên cùng ngửa, 24 lá ở chồng rút, đủ 52 lá.
const g = K.newGame(42, { draw: 1 });
K.TABLEAU.forEach((t, i) => {
  assert.equal(g.piles[t].length, i + 1);
  g.piles[t].forEach((id, j) => assert.equal(!!g.up[id], j === i, 'chỉ lá trên cùng ngửa'));
});
assert.equal(g.piles.stock.length, 24);
assert.ok(verifyPiles(g.piles, K.expectedIds()));
assert.deepEqual(K.newGame(42, { draw: 1 }).piles, g.piles, 'cùng seed → cùng ván');
assert.deepEqual(K.normalizeOptions({ draw: 7 }), { draw: 1 });

// Luật cột: giảm dần, xen kẽ màu; chỉ K vào cột trống.
let s = emptyState();
s.piles.t0 = ['S13.0']; s.piles.t1 = ['H12.0']; s.piles.t2 = ['D12.0']; s.piles.t3 = ['C12.0']; s.piles.t4 = [];
s.piles.t5 = ['H5.0', 'S9.0'];
faceUp(s, ['S13.0', 'H12.0', 'D12.0', 'C12.0', 'S9.0']);
assert.ok(K.tryMove(s, { from: 't1', index: 0, to: 't0' }), 'Q♥ lên K♠');
assert.equal(K.tryMove(s, { from: 't3', index: 0, to: 't0' }), null, 'Q♣ không lên K♠ (cùng màu)');
assert.equal(K.tryMove(s, { from: 't1', index: 0, to: 't4' }), null, 'Q không vào cột trống');
const kToEmpty = K.tryMove(s, { from: 't0', index: 0, to: 't4' });
assert.ok(kToEmpty && kToEmpty.piles.t4[0] === 'S13.0', 'K vào cột trống');
assert.equal(K.tryMove(s, { from: 't5', index: 0, to: 't6' }), null, 'không cầm lá úp');

// Tự lật lá úp lộ ra sau khi chuyển.
const flipped = K.tryMove(s, { from: 't5', index: 1, to: 't6' });
assert.equal(flipped, null, 'cột trống không nhận 9');
s.piles.t6 = ['D10.0']; faceUp(s, ['D10.0']);
const after = K.tryMove(s, { from: 't5', index: 1, to: 't6' });
assert.ok(after.up['H5.0'], 'lá úp được lật');
assert.equal(after.moves, 1);
assert.ok(!s.up['H5.0'], 'trạng thái gốc không đổi (thuần)');

// Chuyển chuỗi bài ngửa hợp lệ; chuỗi sai màu bị từ chối.
s = emptyState();
s.piles.t0 = ['S13.0', 'H12.0', 'C11.0', 'D10.0']; s.piles.t1 = ['D13.0']; s.piles.t2 = ['H13.0', 'D12.0', 'S11.0'];
faceUp(s, [...s.piles.t0, 'D13.0', ...s.piles.t2]);
s.piles.t3 = ['C13.0'];
faceUp(s, ['C13.0']);
assert.ok(K.canPick(s, 't0', 1));
const ok = K.tryMove(s, { from: 't0', index: 1, to: 't1' });
assert.equal(ok, null, 'Q♥ không lên K♦ (cùng màu đỏ)');
const ok2 = K.tryMove(s, { from: 't0', index: 1, to: 't3' });
assert.ok(ok2, 'chuỗi Q♥-J♣-10♦ lên K♣');
assert.deepEqual(ok2.piles.t3, ['C13.0', 'H12.0', 'C11.0', 'D10.0']);
const bad = emptyState();
bad.piles.t0 = ['H12.0', 'D11.0']; bad.piles.t1 = ['S13.0'];
faceUp(bad, ['H12.0', 'D11.0', 'S13.0']);
assert.ok(!K.canPick(bad, 't0', 0), 'chuỗi cùng màu không cầm được');

// Chồng đích: cùng chất từ A tới K; chỉ một lá mỗi lần.
s = emptyState();
s.piles.t0 = ['S1.0']; s.piles.t1 = ['S2.0']; s.piles.t2 = ['H2.0']; s.piles.t3 = ['S3.0', 'H2.1'];
faceUp(s, ['S1.0', 'S2.0', 'H2.0']);
assert.equal(K.tryMove(s, { from: 't1', index: 0, to: 'f0' }), null, '2 không lên đích trống');
const a1 = K.tryMove(s, { from: 't0', index: 0, to: 'f0' });
assert.ok(a1);
assert.equal(K.tryMove(a1, { from: 't2', index: 0, to: 'f0' }), null, '2♥ không lên A♠');
assert.ok(K.tryMove(a1, { from: 't1', index: 0, to: 'f0' }), '2♠ lên A♠');
assert.equal(K.foundationFor(a1, 'S2.0'), 'f0');
assert.equal(K.autoTarget(s, 't0', 0), 'f0', 'chạm hai lần đưa A lên đích');

// Rút bài: 1 lá / 3 lá, quay vòng không giới hạn.
s = emptyState(3);
s.piles.stock = ['C1.0', 'C2.0', 'C3.0', 'C4.0', 'C5.0'];
let d = K.drawStock(s);
assert.deepEqual(d.piles.waste, ['C5.0', 'C4.0', 'C3.0']);
assert.ok(d.up['C3.0']);
assert.ok(!K.canPick(d, 'waste', 1), 'chế độ 3 lá: chỉ lá trên cùng');
assert.ok(K.canPick(d, 'waste', 2));
d = K.drawStock(d);
assert.deepEqual(d.piles.waste, ['C5.0', 'C4.0', 'C3.0', 'C2.0', 'C1.0']);
d = K.drawStock(d);
assert.deepEqual(d.piles.stock, ['C1.0', 'C2.0', 'C3.0', 'C4.0', 'C5.0'], 'quay vòng giữ thứ tự ban đầu');
assert.equal(d.piles.waste.length, 0);
assert.ok(!d.up['C1.0']);
assert.equal(d.passes, 1);
for (let i = 0; i < 20; i++) d = K.drawStock(d);
assert.ok(d, 'quay vòng nhiều lần');
const s1 = emptyState(1);
s1.piles.stock = ['C1.0', 'C2.0'];
assert.deepEqual(K.drawStock(s1).piles.waste, ['C2.0']);
assert.equal(K.drawStock(emptyState()), null);

// Hoàn tác phục hồi đúng trạng thái; lưu/tải không đổi bài; chơi lại giữ thứ tự chia.
const session = createSession(K, 777, { draw: 1 });
const initial = JSON.stringify(session.state);
let steps = 0;
for (let i = 0; i < 60 && steps < 25; i++) {
  const h = K.hint(session.state);
  if (!h) break;
  const next = h.move.draw ? K.drawStock(session.state) : K.tryMove(session.state, h.move);
  assert.ok(next, 'gợi ý luôn là nước hợp lệ');
  assert.ok(verifyPiles(next.piles, K.expectedIds()), 'không mất/thêm lá');
  commit(session, next);
  steps++;
}
assert.ok(steps > 0);
const saved = JSON.parse(JSON.stringify(serializeSession(session)));
const restored = restoreSession(K, saved);
assert.deepEqual(restored.state, session.state, 'tải lại giữ nguyên bài');
assert.equal(restored.history.length, session.history.length);
const snapshot = JSON.stringify(session.history[session.history.length - 1]);
undo(session);
assert.equal(JSON.stringify(session.state), snapshot, 'hoàn tác về trạng thái trước');
while (undo(session));
assert.equal(JSON.stringify(session.state), initial, 'hoàn tác hết về đầu ván');
commit(session, K.drawStock(session.state));
restart(K, session);
assert.equal(JSON.stringify(session.state), initial, 'chơi lại: cùng thứ tự chia bài');
assert.equal(session.history.length, 0);
const corrupt = JSON.parse(JSON.stringify(saved));
corrupt.state.piles.t0.push(corrupt.state.piles.t1[0]);
assert.equal(restoreSession(K, corrupt), null, 'bản lưu trùng lá bị từ chối');

// Thắng: 52 lá trên đích; tự hoàn tất khi mọi lá đã ngửa.
s = emptyState();
const suits = ['S', 'H', 'D', 'C'];
suits.forEach((su, i) => { for (let r = 1; r <= 12; r++) s.piles[`f${i}`].push(`${su}${r}.0`); });
s.piles.t0 = ['S13.0'];
s.piles.t1 = ['H13.0']; s.piles.t2 = ['D13.0']; s.piles.t3 = ['C13.0'];
faceUp(s, ['S13.0', 'H13.0', 'D13.0', 'C13.0']);
assert.ok(!K.isWon(s));
assert.ok(K.canAutoFinish(s));
let fin = s, guard = 0;
while (!K.isWon(fin) && guard++ < 10) fin = K.tryMove(fin, K.nextFinishMove(fin));
assert.ok(K.isWon(fin), 'thắng khi đủ 52 lá trên đích');
assert.ok(!K.canAutoFinish(K.newGame(1, {})), 'đầu ván chưa tự hoàn tất được');

// Gợi ý trên nhiều ván ngẫu nhiên luôn hợp lệ.
for (let seed = 1; seed <= 40; seed++) {
  let st = K.newGame(seed, { draw: seed % 2 ? 1 : 3 });
  for (let i = 0; i < 80; i++) {
    const h = K.hint(st);
    if (!h) break;
    const next = h.move.draw ? K.drawStock(st) : K.tryMove(st, h.move);
    assert.ok(next, `gợi ý hợp lệ (ván ${seed})`);
    st = next;
  }
  assert.ok(verifyPiles(st.piles, K.expectedIds()));
}
assert.ok(cardOf('S13.0').rank === 13);

console.log('✓ Tất cả kiểm thử Klondike đều qua');
