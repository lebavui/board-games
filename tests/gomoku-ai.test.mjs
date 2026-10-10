// Kiểm thử đối thủ máy Cờ caro. Chạy: node tests/gomoku-ai.test.mjs
import assert from 'node:assert/strict';
import { chooseMove, findVCF } from '../js/games/gomoku/ai.js';
import { createGame, play, SIZE, BLACK, WHITE } from '../js/games/gomoku/logic.js';

const at = (r, c) => r * SIZE + c;
const boardWith = (blacks, whites) => {
  const b = new Array(SIZE * SIZE).fill(0);
  blacks.forEach(([r, c]) => { b[at(r, c)] = BLACK; });
  whites.forEach(([r, c]) => { b[at(r, c)] = WHITE; });
  return b;
};

for (const level of ['easy', 'medium', 'hard']) {
  // Thắng ngay khi có bốn.
  let b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[8, 3], [8, 4], [8, 5], [0, 0]]);
  assert.ok([at(7, 2), at(7, 7)].includes(chooseMove(b, BLACK, level)), `${level}: phải thắng`);
}
for (const level of ['medium', 'hard']) {
  // Chặn bốn của đối thủ.
  let b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6], [0, 14]], [[6, 2], [8, 8], [9, 9], [2, 2]]);
  b[at(7, 2)] = WHITE;
  assert.equal(chooseMove(b, WHITE, level), at(7, 7), `${level}: phải chặn bốn`);
  // Chặn ba mở.
  b = boardWith([[7, 5], [7, 6], [7, 7]], [[3, 3], [12, 12]]);
  assert.ok([at(7, 4), at(7, 8), at(7, 3), at(7, 9)].includes(chooseMove(b, WHITE, level)), `${level}: phải chặn ba mở`);
}
console.log('✓ thắng ngay, chặn bốn và chặn ba mở');

// VCF (thắng bằng chuỗi nước bốn ép buộc).
// Hàng 5: Đen (5,5)(5,6)(5,7), Trắng chặn (5,4). Cột 8: Đen (6,8)(7,8)(8,8), Trắng chặn (9,8).
// Đen đặt (5,8) => bốn ngang (cần 5,9) + bốn dọc (cần 4,8): hai điểm thắng.
const vcfBoard = boardWith([[5, 5], [5, 6], [5, 7], [6, 8], [7, 8], [8, 8]], [[5, 4], [9, 8], [0, 0], [0, 14], [14, 0], [14, 14]]);
assert.equal(findVCF(vcfBoard.slice(), BLACK, 10), at(5, 8), 'phải tìm thấy bốn kép');
// Thế phức tạp hơn: mức Khó phải chơi đúng nước mở đầu chuỗi VCF.
const vcf2 = boardWith([[5, 5], [5, 6], [5, 7], [7, 8], [8, 8], [3, 9], [3, 10], [3, 11]], [[5, 4], [9, 8], [3, 8], [0, 0], [14, 0], [14, 14], [0, 14], [13, 13]]);
const first = findVCF(vcf2.slice(), BLACK, 10);
assert.notEqual(first, -1, 'phải tìm thấy VCF nhiều bước');
assert.equal(chooseMove(vcf2, BLACK, 'hard'), first);
console.log('✓ tìm thấy chuỗi bốn ép buộc');

// Tự đấu: Khó gặp Dễ phải thắng phần lớn ván; mọi nước đều hợp lệ.
let wins = 0;
const games = 6;
let maxMs = 0;
for (let g = 0; g < games; g++) {
  const game = createGame();
  const hardColor = g % 2 ? BLACK : WHITE;
  while (!game.result) {
    const turn = game.moves.length % 2 === 0 ? BLACK : WHITE;
    const t = Date.now();
    const mv = chooseMove(game.board, turn, turn === hardColor ? 'hard' : 'easy');
    maxMs = Math.max(maxMs, Date.now() - t);
    assert.ok(play(game, mv), 'nước hợp lệ');
  }
  if (game.result.winner === hardColor) wins++;
}
console.log(`✓ Khó thắng Dễ ${wins}/${games} ván (nước lâu nhất ${maxMs}ms)`);
assert.ok(wins >= games - 1);
console.log('✓ Tất cả kiểm thử AI cờ caro đều qua');
