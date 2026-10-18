// Kiểm thử đối thủ máy Cờ tướng. Chạy: node tests/xiangqi-ai.test.mjs
import assert from 'node:assert/strict';
import { chooseMove } from '../js/games/xiangqi/ai.js';
import { COLS, initialState, applyMove, legalMoves, positionKey } from '../js/games/xiangqi/logic.js';

const sq = (r, c) => r * COLS + c;
function position(pieces, turn = 'r') {
  const board = new Array(90).fill('');
  for (const [key, piece] of Object.entries(pieces)) {
    const [r, c] = key.split(',').map(Number);
    board[sq(r, c)] = piece;
  }
  return { board, turn, moves: [], keys: [positionKey(board, turn)], quiet: 0, result: null };
}
let seed = 7;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// Thấy chiếu bí một nước (hai Xe).
{
  const s = position({ '9,3': 'K', '0,4': 'k', '2,0': 'R', '1,8': 'R' });
  for (const level of ['medium', 'hard']) {
    const m = chooseMove(s, level, rng);
    assert.equal(applyMove(s, m).result?.reason, 'checkmate', `${level}: chiếu bí ngay`);
  }
}
console.log('✓ tìm được chiếu bí một nước');

// Ăn Xe không được bảo vệ.
{
  const s = position({ '9,3': 'K', '0,5': 'k', '7,0': 'R', '7,6': 'r', '2,8': 'n' });
  for (const level of ['medium', 'hard']) {
    const m = chooseMove(s, level, rng);
    assert.deepEqual([m.from, m.to], [sq(7, 0), sq(7, 6)], `${level}: ăn Xe miễn phí`);
  }
}
console.log('✓ ăn quân miễn phí');

// Không đưa Xe vào chỗ bị ăn: Xe Đen đang bị Mã Đỏ dọa thì phải chạy.
{
  const s = position({ '9,3': 'K', '0,5': 'k', '5,4': 'N', '3,3': 'r', '9,8': 'R' }, 'b');
  for (const level of ['medium', 'hard']) {
    const m = chooseMove(s, level, rng);
    const after = applyMove(s, m);
    const hanging = legalMoves(after).some((x) => after.board[x.to] === 'r');
    assert.ok(!hanging, `${level}: không để mất Xe`);
  }
}
console.log('✓ không để mất quân lớn');

// Chỉ trả về nước hợp lệ; bên hết nước trả null.
{
  const s = initialState();
  const m = chooseMove(s, 'easy', rng);
  assert.ok(legalMoves(s).some((x) => x.from === m.from && x.to === m.to));
  const done = { ...s, result: { winner: 'r', reason: 'resign' } };
  assert.equal(chooseMove(done, 'hard'), null);
}

// Tự đấu: Khó gặp Dễ; Khó không được thua và mỗi nước không vượt quá giới hạn thời gian nhiều.
{
  let hardScore = 0, maxMs = 0;
  const games = 2;
  for (let g = 0; g < games; g++) {
    let st = initialState();
    const hardColor = g % 2 ? 'b' : 'r';
    for (let ply = 0; ply < 160 && !st.result; ply++) {
      const level = st.turn === hardColor ? 'hard' : 'easy';
      const t0 = Date.now();
      const m = chooseMove(st, level, rng);
      if (level === 'hard') maxMs = Math.max(maxMs, Date.now() - t0);
      st = applyMove(st, m);
      assert.ok(st, 'máy chỉ đi nước hợp lệ');
    }
    if (st.result?.winner === hardColor) hardScore += 1;
    else if (!st.result || !st.result.winner) hardScore += 0.5;
    else assert.fail(`Khó thua Dễ (ván ${g + 1}: ${st.result.reason})`);
  }
  assert.ok(maxMs < 3500, `Khó nghĩ quá lâu: ${maxMs} ms`);
  console.log(`✓ Khó gặp Dễ: ${hardScore}/${games} điểm, nước lâu nhất ${maxMs} ms`);
}

console.log('✓ Đối thủ máy Cờ tướng: mọi kiểm thử đều qua');
