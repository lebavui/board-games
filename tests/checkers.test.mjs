// Kiểm thử luật Cờ đam (American Checkers). Chạy: node tests/checkers.test.mjs
import assert from 'node:assert/strict';
import { initialState, legalSteps, applyStep, squareNumber, notation } from '../js/games/checkers/logic.js';

const idx = (r, c) => r * 8 + c;
const empty = (turn = 'b') => ({ board: new Array(64).fill(''), turn, forced: null, path: null, moves: [], result: null });

// Thế ban đầu: 12 quân mỗi bên, chỉ trên ô tối, Đen đi trước với 7 nước.
let s = initialState();
assert.equal(s.board.filter((p) => p === 'b').length, 12);
assert.equal(s.board.filter((p) => p === 'r').length, 12);
assert.ok(s.board.every((p, i) => !p || (Math.floor(i / 8) + (i % 8)) % 2 === 1));
assert.equal(legalSteps(s).length, 7);
assert.equal(squareNumber(idx(0, 1)), 1);
assert.equal(squareNumber(idx(7, 6)), 32);

// Quân thường chỉ đi tiến; không đi lùi.
s = empty('b');
s.board[idx(3, 2)] = 'b';
s.board[idx(7, 0)] = 'r';
assert.deepEqual(legalSteps(s).map((m) => m.to).sort(), [idx(4, 1), idx(4, 3)].sort());

// Bắt bắt buộc: có nước bắt thì chỉ được bắt.
s = empty('b');
s.board[idx(2, 1)] = 'b';
s.board[idx(3, 2)] = 'r';
s.board[idx(2, 5)] = 'b';
let steps = legalSteps(s);
assert.equal(steps.length, 1);
assert.equal(steps[0].capture, idx(3, 2));

// Quân thường không bắt lùi.
s = empty('b');
s.board[idx(4, 3)] = 'b';
s.board[idx(3, 2)] = 'r';
s.board[idx(7, 0)] = 'r';
assert.ok(legalSteps(s).every((m) => m.capture === null));

// Nhảy liên tiếp bắt buộc bằng cùng quân; người chơi được chọn nhánh.
s = empty('b');
s.board[idx(0, 1)] = 'b';
s.board[idx(1, 2)] = 'r';
s.board[idx(3, 4)] = 'r';
s.board[idx(3, 2)] = 'r';
s.board[idx(7, 6)] = 'r';
s = applyStep(s, { from: idx(0, 1), to: idx(2, 3) });
assert.equal(s.turn, 'b', 'vẫn lượt Đen khi còn nhảy được');
assert.equal(s.forced, idx(2, 3));
steps = legalSteps(s);
assert.deepEqual(steps.map((m) => m.to).sort(), [idx(4, 1), idx(4, 5)].sort(), 'hai nhánh nhảy để chọn');
s = applyStep(s, { from: idx(2, 3), to: idx(4, 5) });
assert.equal(s.turn, 'r');
assert.equal(s.moves.at(-1).squares.length, 3);
assert.equal(notation(s.moves.at(-1)), '1×10×19');

// Phong vua kết thúc lượt dù vua mới có thể bắt tiếp.
s = empty('b');
s.board[idx(5, 2)] = 'b';
s.board[idx(6, 3)] = 'r';
s.board[idx(6, 5)] = 'r';
s.board[idx(0, 7)] = 'r';
s = applyStep(s, { from: idx(5, 2), to: idx(7, 4) });
assert.equal(s.board[idx(7, 4)], 'B');
assert.equal(s.turn, 'r', 'phong vua kết thúc lượt');
assert.equal(s.forced, null);

// Vua đi và bắt cả hai hướng, mỗi bước một ô (không bay).
s = empty('r');
s.board[idx(4, 3)] = 'R';
s.board[idx(5, 4)] = 'b';
s.board[idx(0, 1)] = 'b';
steps = legalSteps(s);
assert.deepEqual(steps.map((m) => m.to), [idx(6, 5)]);

// Thắng khi đối phương hết quân.
s = empty('r');
s.board[idx(4, 3)] = 'r';
s.board[idx(3, 2)] = 'b';
s = applyStep(s, { from: idx(4, 3), to: idx(2, 1) });
assert.deepEqual(s.result, { winner: 'r', reason: 'no-pieces' });

// Thắng khi đối phương không còn nước đi hợp lệ (bị chặn).
s = empty('r');
s.board[idx(0, 1)] = 'b';   // quân Đen ở góc, bị chặn
s.board[idx(1, 0)] = 'r';
s.board[idx(1, 2)] = 'r';
s.board[idx(2, 3)] = 'r';   // chặn ô nhảy
s.board[idx(7, 6)] = 'r';
s = applyStep(s, { from: idx(7, 6), to: idx(6, 5) });
assert.deepEqual(s.result, { winner: 'r', reason: 'no-moves' });
assert.equal(legalSteps(s).length, 0, 'khóa nước đi sau khi kết thúc');

console.log('✓ Tất cả kiểm thử cờ đam đều qua');
