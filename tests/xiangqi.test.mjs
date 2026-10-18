// Kiểm thử luật Cờ tướng. Chạy: node tests/xiangqi.test.mjs
import assert from 'node:assert/strict';
import {
  COLS, initialState, legalMoves, applyMove, replay, inCheck, notation, positionKey, capturedPieces, NO_CAPTURE_LIMIT,
} from '../js/games/xiangqi/logic.js';

const sq = (r, c) => r * COLS + c;
/** Trạng thái từ danh sách quân { 'r,c': piece }. */
function position(pieces, turn = 'r') {
  const board = new Array(90).fill('');
  for (const [key, piece] of Object.entries(pieces)) {
    const [r, c] = key.split(',').map(Number);
    board[sq(r, c)] = piece;
  }
  return { board, turn, moves: [], keys: [positionKey(board, turn)], quiet: 0, result: null };
}
const targets = (state, from) => legalMoves(state).filter((m) => m.from === from).map((m) => m.to).sort((a, b) => a - b);

// Perft từ thế ban đầu: số liệu chuẩn 44, 1 920, 79 666.
function perft(state, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(state)) {
    if (depth === 1) { n++; continue; }
    const next = applyMove(state, m);
    n += next.result ? 0 : perft(next, depth - 1);
  }
  return n;
}
const start = initialState();
assert.equal(perft(start, 1), 44);
assert.equal(perft(start, 2), 1920);
assert.equal(perft(start, 3), 79666);
console.log('✓ perft 1–3 khớp số liệu chuẩn');

// Mã bị cản chân, Tượng bị cản mắt và không qua sông.
{
  let s = position({ '9,4': 'K', '0,4': 'k', '5,4': 'N', '4,4': 'P' });
  // Chân phía trên bị cản → không đi được hai nước (3,3) và (3,5).
  assert.deepEqual(targets(s, sq(5, 4)), [sq(4, 2), sq(4, 6), sq(6, 2), sq(6, 6), sq(7, 3), sq(7, 5)].sort((a, b) => a - b));
  s = position({ '9,4': 'K', '0,3': 'k', '7,4': 'B', '6,3': 'P' });
  assert.deepEqual(targets(s, sq(7, 4)), [sq(5, 6), sq(9, 2), sq(9, 6)].sort((a, b) => a - b), 'mắt tượng (6,3) bị cản');
  s = position({ '9,4': 'K', '0,3': 'k', '5,2': 'B' });
  assert.deepEqual(targets(s, sq(5, 2)), [sq(7, 0), sq(7, 4)].sort((a, b) => a - b), 'tượng không qua sông');
}

// Pháo: đi như Xe khi không ăn, ăn phải nhảy qua đúng một ngòi.
{
  const s = position({ '9,3': 'K', '0,5': 'k', '7,1': 'C', '4,1': 'p', '2,1': 'n', '1,1': 'r', '7,4': 'P' });
  const t = targets(s, sq(7, 1));
  assert.ok(t.includes(sq(5, 1)) && t.includes(sq(6, 1)), 'đi tới trước ngòi');
  assert.ok(!t.includes(sq(4, 1)), 'không ăn trực tiếp quân kề');
  assert.ok(t.includes(sq(2, 1)), 'ăn quân sau một ngòi');
  assert.ok(!t.includes(sq(1, 1)) && !t.includes(sq(3, 1)), 'không ăn qua hai ngòi, không đứng sau ngòi');
  assert.ok(t.includes(sq(7, 3)) && !t.includes(sq(7, 4)), 'không ăn quân mình');
}

// Tốt: chưa qua sông chỉ tiến; qua sông được đi ngang, không bao giờ lùi.
{
  let s = position({ '9,3': 'K', '0,5': 'k', '6,2': 'P' });
  assert.deepEqual(targets(s, sq(6, 2)), [sq(5, 2)]);
  s = position({ '9,3': 'K', '0,5': 'k', '4,2': 'P' });
  assert.deepEqual(targets(s, sq(4, 2)), [sq(3, 2), sq(4, 1), sq(4, 3)].sort((a, b) => a - b));
  s = position({ '9,3': 'K', '0,5': 'k', '0,0': 'P' });
  assert.deepEqual(targets(s, sq(0, 0)), [sq(0, 1)], 'tốt đáy chỉ đi ngang');
  s = position({ '9,3': 'K', '0,5': 'k', '3,6': 'p' }, 'b');
  assert.deepEqual(targets(s, sq(3, 6)), [sq(4, 6)], 'tốt Đen tiến xuống');
}

// Tướng và Sĩ không rời cung; hai Tướng không được đối mặt.
{
  let s = position({ '9,3': 'K', '0,5': 'k', '9,4': 'A' });
  assert.deepEqual(targets(s, sq(9, 4)), [sq(8, 3), sq(8, 5)].sort((a, b) => a - b));
  assert.deepEqual(targets(s, sq(9, 3)), [sq(8, 3)], 'Tướng không ra khỏi cung, không bước sang cột Tướng đối phương');
  s = position({ '9,4': 'K', '0,4': 'k', '5,4': 'R' });
  assert.ok(!targets(s, sq(5, 4)).includes(sq(5, 3)), 'Xe đang che mặt Tướng không được rời cột');
  assert.ok(targets(s, sq(5, 4)).includes(sq(1, 4)), 'đi dọc trên cột vẫn được');
  assert.equal(inCheck(position({ '9,4': 'K', '0,4': 'k' }).board, 'r'), true, 'lộ mặt Tướng tính là bị chiếu');
}

// Chiếu bằng Mã (chân không bị cản), Pháo, Tốt; tránh chiếu bắt buộc.
{
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '7,3': 'n' }).board, 'r'), true);
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '7,3': 'n', '8,3': 'A' }).board, 'r'), false, 'chân mã bị cản');
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '5,4': 'c', '7,4': 'P' }).board, 'r'), true, 'pháo có ngòi');
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '5,4': 'c' }).board, 'r'), false, 'pháo không ngòi');
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '8,4': 'p' }).board, 'r'), true, 'tốt phía trước');
  assert.equal(inCheck(position({ '9,4': 'K', '0,3': 'k', '9,3': 'p' }).board, 'r'), true, 'tốt đi ngang');
  const s = position({ '9,4': 'K', '0,3': 'k', '5,4': 'r', '9,0': 'R' });
  for (const m of legalMoves(s)) assert.equal(inCheck(applyMove(s, m).board, 'r'), false, 'mọi nước hợp lệ đều chống được chiếu');
}

// Chiếu bí và hết nước (vây khốn) đều là thua cho bên phải đi.
{
  // Hai Xe Đỏ chiếu bí: Xe ở hàng 0 chiếu, Xe ở hàng 1 khóa đường lui.
  let s = position({ '9,3': 'K', '0,4': 'k', '2,0': 'R', '1,8': 'R' });
  s = applyMove(s, { from: sq(2, 0), to: sq(0, 0) });
  assert.deepEqual(s.result, { winner: 'r', reason: 'checkmate' });
  // Tướng Đen không bị chiếu nhưng không còn nước nào: thua.
  s = position({ '9,3': 'K', '0,4': 'k', '2,3': 'R', '2,5': 'R', '8,0': 'R' });
  s = applyMove(s, { from: sq(8, 0), to: sq(1, 0) });
  assert.equal(inCheck(s.board, 'b'), false);
  assert.deepEqual(s.result, { winner: 'r', reason: 'stalemate' });
}

// Hòa do lặp ba lần, 60 nước không ăn quân, hết quân tấn công.
{
  let s = position({ '9,3': 'K', '0,5': 'k', '7,0': 'R', '2,8': 'r' });
  const loop = [[sq(7, 0), sq(6, 0)], [sq(2, 8), sq(3, 8)], [sq(6, 0), sq(7, 0)], [sq(3, 8), sq(2, 8)]];
  for (let k = 0; k < 8 && !s.result; k++) s = applyMove(s, { from: loop[k % 4][0], to: loop[k % 4][1] });
  assert.deepEqual(s.result, { winner: null, reason: 'repetition' });

  s = position({ '9,3': 'K', '0,5': 'k', '7,0': 'R', '2,8': 'r' });
  s.quiet = NO_CAPTURE_LIMIT - 1;
  s = applyMove(s, { from: sq(7, 0), to: sq(6, 0) });
  assert.deepEqual(s.result, { winner: null, reason: 'no-capture' });

  // Tướng Đỏ ăn Xe Đen đang chiếu: chỉ còn Tướng + Sĩ → không bên nào chiếu bí được.
  s = position({ '9,4': 'K', '0,5': 'k', '8,4': 'r', '9,3': 'A' });
  s = applyMove(s, { from: sq(9, 4), to: sq(8, 4) });
  assert.deepEqual(s.result, { winner: null, reason: 'material' });
  assert.deepEqual(capturedPieces(s), { r: [], b: ['r'] });
}

// Ký hiệu kiểu Việt Nam.
{
  const b = initialState().board;
  assert.equal(notation(b, sq(7, 7), sq(7, 4)), 'P2-5', 'Pháo 2 bình 5');
  assert.equal(notation(b, sq(9, 7), sq(7, 6)), 'M2.3', 'Mã 2 tấn 3');
  assert.equal(notation(b, sq(9, 8), sq(8, 8)), 'X1.1', 'Xe 1 tấn 1');
  assert.equal(notation(b, sq(6, 4), sq(5, 4)), 'B5.1', 'Binh 5 tấn 1');
  assert.equal(notation(b, sq(9, 6), sq(7, 4)), 'T3.5', 'Tượng 3 tấn 5');
  assert.equal(notation(b, sq(9, 5), sq(8, 4)), 'S4.5', 'Sĩ 4 tấn 5');
  assert.equal(notation(b, sq(2, 1), sq(2, 4)), 'P2-5', 'Pháo Đen 2 bình 5');
  assert.equal(notation(b, sq(0, 1), sq(2, 2)), 'M2.3', 'Mã Đen 2 tấn 3');
  const s = position({ '9,3': 'K', '0,5': 'k', '5,0': 'R', '8,0': 'R' });
  assert.equal(notation(s.board, sq(5, 0), sq(5, 2)), 'Xt-7', 'Xe trước');
  assert.equal(notation(s.board, sq(8, 0), sq(9, 0)), 'Xs/1', 'Xe sau thoái 1');
}

// Áp dụng nước sai trả null; replay dựng lại đúng thế cờ và từ chối bản lưu hỏng.
{
  const s = initialState();
  assert.equal(applyMove(s, { from: sq(9, 0), to: sq(5, 0) }), null, 'Xe không nhảy qua Tốt');
  assert.equal(applyMove(s, { from: sq(0, 0), to: sq(1, 0) }), null, 'không đi quân đối phương');
  const moves = [{ from: sq(7, 7), to: sq(7, 4) }, { from: sq(0, 1), to: sq(2, 2) }, { from: sq(9, 7), to: sq(7, 6) }];
  let t = s;
  for (const m of moves) t = applyMove(t, m);
  assert.deepEqual(replay(moves).board, t.board);
  assert.equal(replay([...moves, { from: 0, to: 89 }]), null);
  assert.equal(replay([{ from: 'x' }]), null);
}

console.log('✓ Cờ tướng: mọi kiểm thử luật đều qua');
