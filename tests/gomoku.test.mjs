// Kiểm thử Cờ caro. Chạy: node tests/gomoku.test.mjs
import assert from 'node:assert/strict';
import { createGame, play, undo, fromMoves, SIZE, BLACK, WHITE } from '../js/games/gomoku/logic.js';

const at = (r, c) => r * SIZE + c;

// Năm quân ngang của Đen thắng.
let g = createGame();
for (let k = 0; k < 4; k++) { play(g, at(7, 3 + k)); play(g, at(8, 3 + k)); }
assert.equal(g.result, null);
play(g, at(7, 7));
assert.equal(g.result.winner, BLACK);
assert.equal(g.result.line.length, 5);
assert.equal(play(g, at(0, 0)), false, 'khóa bàn sau khi thắng');

// Chéo ngược cho Trắng.
g = createGame();
play(g, at(0, 0));
for (let k = 0; k < 5; k++) { play(g, at(2 + k, 10 - k)); if (k < 4) play(g, at(14, k * 2)); }
assert.equal(g.result.winner, WHITE);

// Luật tự do: chuỗi 6 quân (overline) vẫn thắng, nối hai đoạn.
g = fromMoves([at(5, 0), at(6, 0), at(5, 1), at(6, 1), at(5, 2), at(6, 2), at(5, 4), at(6, 4), at(5, 5), at(9, 9)]);
assert.equal(g.result, null);
g = fromMoves([at(5, 0), at(6, 0), at(5, 1), at(6, 1), at(5, 2), at(6, 2), at(5, 4), at(6, 4), at(5, 5), at(9, 9), at(5, 3)]);
assert.equal(g.result.winner, BLACK);
assert.equal(g.result.line.length, 6);

// Không đặt vào ô đã có quân; hoàn tác.
g = createGame();
play(g, at(7, 7));
assert.equal(play(g, at(7, 7)), false);
undo(g);
assert.equal(g.moves.length, 0);

// Hòa khi bàn đầy mà không có 5 liên tiếp. Mẫu (c + 2r) mod 4 < 2 => Đen: mọi hướng chỉ có chuỗi ≤ 2.
g = createGame();
const pattern = (r, c) => ((c + 2 * r) % 4 < 2 ? BLACK : WHITE);
const last = at(0, 0); // pattern = Đen, đúng lượt Đen sau 224 nước
for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
  if (at(r, c) === last) continue;
  g.board[at(r, c)] = pattern(r, c);
  g.moves.push(at(r, c));
}
assert.ok(play(g, last));
assert.deepEqual(g.result, { winner: 0, line: null });

console.log('✓ Tất cả kiểm thử cờ caro đều qua');
