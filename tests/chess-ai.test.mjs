// Kiểm thử đối thủ máy Cờ vua. Chạy: node tests/chess-ai.test.mjs
import assert from 'node:assert/strict';
import { Chess } from '../js/vendor/chess.js';
import { chooseMove } from '../js/games/chess/ai.js';


// Chiếu hết trong 1: sau 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? Trắng phải chơi Qxf7#.
const hist = [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }, { from: 'f1', to: 'c4' }, { from: 'b8', to: 'c6' }, { from: 'd1', to: 'h5' }, { from: 'g8', to: 'f6' }];
for (const level of ['medium', 'hard']) {
  const t = Date.now();
  const m = chooseMove(hist, level);
  assert.deepEqual([m.from, m.to], ['h5', 'f7'], `${level} phải thấy chiếu hết`);
  console.log(`✓ ${level}: thấy chiếu hết trong 1 (${Date.now() - t}ms)`);
}

// Đen phải đỡ dọa chiếu hết: sau 1.e4 e5 2.Qh5 Nc6 3.Bc4 — Đen không được để Qxf7#.
const threat = [{ from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' }, { from: 'd1', to: 'h5' }, { from: 'b8', to: 'c6' }, { from: 'f1', to: 'c4' }];
for (const level of ['medium', 'hard']) {
  const m = chooseMove(threat, level);
  const c = new Chess();
  threat.forEach((x) => c.move(x));
  c.move(m);
  const mates = c.moves({ verbose: true }).some((x) => { c.move(x); const mate = c.isCheckmate(); c.undo(); return mate; });
  assert.ok(!mates, `${level}: ${m.from}${m.to} để bị chiếu hết`);
  console.log(`✓ ${level}: đỡ được dọa chiếu hết (${m.from}-${m.to})`);
}

// Ăn quân miễn phí: Hậu đen treo ở d4.
const free = [{ from: 'e2', to: 'e4' }, { from: 'd7', to: 'd5' }, { from: 'e4', to: 'd5' }, { from: 'd8', to: 'd5' }, { from: 'g1', to: 'f3' }, { from: 'd5', to: 'd4' }];
for (const level of ['medium', 'hard']) {
  const m = chooseMove(free, level);
  assert.deepEqual([m.from, m.to], ['f3', 'd4'], `${level} phải ăn Hậu`);
}
console.log('✓ ăn quân bị treo');

// Mọi mức đều trả về nước hợp lệ ở thế đầu, và null khi hết ván.
for (const level of ['easy', 'medium', 'hard']) {
  const m = chooseMove([], level);
  const c = new Chess();
  assert.ok(c.move(m), `${level}: nước hợp lệ`);
}
assert.equal(chooseMove([...hist, { from: 'h5', to: 'f7' }], 'hard'), null);
console.log('✓ Tất cả kiểm thử AI cờ vua đều qua');
