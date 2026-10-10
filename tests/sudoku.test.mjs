// Kiểm thử Sudoku: bộ giải, tính duy nhất của đề sinh ra, phân loại độ khó và kiểm tra hoàn thành.
// Chạy: node tests/sudoku.test.mjs
import assert from 'node:assert/strict';
import { generatePuzzle, countSolutions, gradePuzzle, isComplete, findConflicts, createRng } from '../js/games/sudoku/logic.js';

for (const difficulty of ['easy', 'medium', 'hard']) {
  for (let seed = 1; seed <= 15; seed++) {
    const g = generatePuzzle(difficulty, createRng(seed * 7919));
    assert.equal(countSolutions(g.puzzle, 2).count, 1, `${difficulty}#${seed}: phải có đúng một lời giải`);
    assert.ok(isComplete(g.solution), 'lời giải hợp lệ');
    assert.ok(g.puzzle.every((v, i) => !v || v === g.solution[i]), 'số đề bài khớp lời giải');
    if (difficulty === 'easy') assert.ok(g.clues >= 36 && g.level === 1, `easy#${seed}: ${g.clues} gợi ý, mức ${g.level}`);
    if (difficulty === 'medium') assert.ok(g.clues >= 30 && g.clues <= 35 && g.level <= 2, `medium#${seed}`);
    if (difficulty === 'hard') assert.ok(g.clues < 36, `hard#${seed}`);
  }
  console.log(`✓ ${difficulty}: 15 đề đều có đúng một lời giải`);
}

// Đề kinh điển cần kỹ thuật nâng cao (“AI Escargot”) phải được chấm mức 3 và vẫn duy nhất.
const escargot = '100007090030020008009600500005300900010080002600004000300000010040000007007000300'.split('').map(Number);
assert.equal(countSolutions(escargot, 2).count, 1);
assert.equal(gradePuzzle(escargot).level, 3);

// Bộ giải phát hiện đề nhiều lời giải và đề vô nghiệm.
const empty = new Array(81).fill(0);
assert.equal(countSolutions(empty, 2).count, 2);
const bad = empty.slice(); bad[0] = 5; bad[1] = 5;
assert.equal(countSolutions(bad, 2).count, 0);

// Kiểm tra hoàn thành và phát hiện trùng số.
const g = generatePuzzle('easy', createRng(42));
assert.ok(isComplete(g.solution));
const broken = g.solution.slice();
[broken[0], broken[1]] = [broken[1], broken[0]];
assert.ok(!isComplete(broken));
assert.ok(findConflicts(broken).size > 0);
console.log('✓ Tất cả kiểm thử Sudoku đều qua');
