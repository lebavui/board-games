// Kiểm thử đối thủ máy Cờ đam. Chạy: node tests/checkers-ai.test.mjs
import assert from 'node:assert/strict';
import { chooseMove, turnMoves } from '../js/games/checkers/ai.js';
import { initialState, applyStep, legalSteps } from '../js/games/checkers/logic.js';

const idx = (r, c) => r * 8 + c;
const empty = (turn) => ({ board: new Array(64).fill(''), turn, forced: null, path: null, moves: [], result: null });

// Gộp chuỗi nhảy thành một lượt.
let s = empty('b');
s.board[idx(0, 1)] = 'b';
s.board[idx(1, 2)] = 'r';
s.board[idx(3, 4)] = 'r';
s.board[idx(7, 6)] = 'r';
const tm = turnMoves(s);
assert.equal(tm.length, 1);
assert.equal(tm[0].steps.length, 2, 'nhảy hai lần trong một lượt');

// Chọn nhánh bắt nhiều quân hơn khi có lợi.
s = empty('b');
s.board[idx(2, 3)] = 'b';
s.board[idx(3, 2)] = 'r';           // nhánh trái: bắt 1
s.board[idx(3, 4)] = 'r';           // nhánh phải: bắt 2
s.board[idx(5, 6)] = 'r';
s.board[idx(7, 0)] = 'r';
for (const level of ['medium', 'hard']) {
  const steps = chooseMove(s, level);
  assert.equal(steps.length, 2, `${level}: chọn chuỗi bắt 2 quân`);
}
console.log('✓ chọn chuỗi bắt tốt nhất');

// Tránh để mất quân miễn phí: Đỏ đi 22-18?? cho Đen bắt.
s = empty('r');
s.board[idx(5, 2)] = 'r';
s.board[idx(3, 2)] = 'b';
s.board[idx(0, 7)] = 'b';
s.board[idx(7, 0)] = 'r';
for (const level of ['medium', 'hard']) {
  const steps = chooseMove(s, level);
  const after = steps.reduce((st, step) => applyStep(st, step), s);
  assert.ok(!legalSteps(after).some((x) => x.capture !== null), `${level}: không thí quân`);
}
console.log('✓ không thí quân vô ích');

// Tự đấu: Khó gặp Dễ.
let wins = 0, maxMs = 0;
const games = 4;
for (let g = 0; g < games; g++) {
  let st = initialState();
  const hardColor = g % 2 ? 'b' : 'r';
  for (let ply = 0; ply < 300 && !st.result; ply++) {
    const t = Date.now();
    const steps = chooseMove(st, st.turn === hardColor ? 'hard' : 'easy');
    maxMs = Math.max(maxMs, Date.now() - t);
    for (const step of steps) { st = applyStep(st, step); assert.ok(st, 'bước hợp lệ'); }
  }
  if (st.result?.winner === hardColor) wins++;
}
console.log(`✓ Khó thắng Dễ ${wins}/${games} ván (nước lâu nhất ${maxMs}ms)`);
assert.ok(wins >= games - 1);
console.log('✓ Tất cả kiểm thử AI cờ đam đều qua');
