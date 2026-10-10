// Kiểm chứng bộ đề Kakuro: cấu trúc hợp lệ, đúng một lời giải và khớp lời giải lưu kèm.
// Chạy: node tests/kakuro.test.mjs
import assert from 'node:assert/strict';
import { PUZZLES } from '../js/games/kakuro/puzzles.js';
import { parsePuzzle, verifyPuzzle, isSolved, countSolutions } from '../js/games/kakuro/logic.js';

assert.ok(PUZZLES.length >= 3, 'Cần ít nhất ba đề');
assert.equal(new Set(PUZZLES.map((p) => p.id)).size, PUZZLES.length, 'id đề phải khác nhau');

for (const def of PUZZLES) {
  const result = verifyPuzzle(def);
  assert.ok(result.ok, `${def.id}: ${result.errors.join('; ')}`);
  const model = parsePuzzle(def);
  const solved = model.cells.map((row) => row.map((c) => (c.type === 'white' ? c.solution : 0)));
  assert.ok(isSolved(model, solved), `${def.id}: lời giải lưu kèm phải thắng`);
  // Đổi một ô sang chữ số khác thì không còn thắng.
  const [r, c] = model.whites[0];
  solved[r][c] = (solved[r][c] % 9) + 1;
  assert.ok(!isSolved(model, solved), `${def.id}: lời giải sai không được tính thắng`);
  console.log(`✓ ${def.id} (${model.width}×${model.height}, ${model.whites.length} ô trắng) — đúng một lời giải`);
}

// Bộ giải phải phát hiện đề nhiều lời giải: dãy 2×2 tổng 3/4 (1,2 / 3,1 ...) có thể đảo.
const ambiguous = parsePuzzle({ rows: ['###', '#12', '#21'] });
assert.equal(countSolutions(ambiguous, 2).count, 2, 'Bộ giải phải đếm được nhiều lời giải');
console.log('✓ bộ giải phát hiện đề nhiều lời giải');
