// Luật American Checkers / English Draughts trên bàn 8×8.
// Bàn là mảng 64 phần tử: '' trống, 'b' quân Đen, 'B' vua Đen, 'r' quân Đỏ, 'R' vua Đỏ.
// Chỉ dùng ô tối: (hàng + cột) lẻ. Đen ở trên (hàng 0–2) đi xuống và đi trước; Đỏ ở dưới đi lên.
// Một "bước" là một lần đi hoặc một lần nhảy; nhảy liên tiếp được thực hiện từng bước bằng cùng một quân.

export const COLOR_NAMES = { b: 'Đen', r: 'Đỏ' };

export const isDark = (r, c) => (r + c) % 2 === 1;
export const squareNumber = (i) => Math.floor(i / 8) * 4 + Math.floor((i % 8) / 2) + 1;
const colorOf = (piece) => (piece ? piece.toLowerCase() : null);
const isKing = (piece) => piece === 'B' || piece === 'R';
const opponent = (color) => (color === 'b' ? 'r' : 'b');

export function initialState() {
  const board = new Array(64).fill('');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (!isDark(r, c)) continue;
      if (r <= 2) board[r * 8 + c] = 'b';
      else if (r >= 5) board[r * 8 + c] = 'r';
    }
  }
  return { board, turn: 'b', forced: null, path: null, moves: [], result: null };
}

function directions(piece) {
  if (isKing(piece)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return colorOf(piece) === 'b' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
}

function stepsFrom(board, i) {
  const piece = board[i];
  const r = Math.floor(i / 8), c = i % 8;
  const moves = [], jumps = [];
  for (const [dr, dc] of directions(piece)) {
    const r1 = r + dr, c1 = c + dc;
    if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const mid = r1 * 8 + c1;
    if (!board[mid]) { moves.push({ from: i, to: mid, capture: null }); continue; }
    if (colorOf(board[mid]) === colorOf(piece)) continue;
    const r2 = r + 2 * dr, c2 = c + 2 * dc;
    if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
    const to = r2 * 8 + c2;
    if (!board[to]) jumps.push({ from: i, to, capture: mid });
  }
  return { moves, jumps };
}

/** Các bước hợp lệ cho bên đang đi. Có thể bắt thì bắt buộc bắt; đang nhảy dở thì chỉ quân đó được nhảy tiếp. */
export function legalSteps(state) {
  if (state.result) return [];
  if (state.forced !== null) return stepsFrom(state.board, state.forced).jumps;
  const moves = [], jumps = [];
  state.board.forEach((piece, i) => {
    if (colorOf(piece) !== state.turn) return;
    const s = stepsFrom(state.board, i);
    moves.push(...s.moves);
    jumps.push(...s.jumps);
  });
  return jumps.length ? jumps : moves;
}

/** Áp dụng một bước (phải nằm trong legalSteps). Trả về trạng thái mới, không sửa trạng thái cũ. */
export function applyStep(state, step) {
  const legal = legalSteps(state).find((s) => s.from === step.from && s.to === step.to);
  if (!legal) return null;
  const board = state.board.slice();
  let piece = board[legal.from];
  board[legal.from] = '';
  if (legal.capture !== null) board[legal.capture] = '';
  const toRow = Math.floor(legal.to / 8);
  let crowned = false;
  if (!isKing(piece) && ((piece === 'b' && toRow === 7) || (piece === 'r' && toRow === 0))) {
    piece = piece.toUpperCase();
    crowned = true;
  }
  board[legal.to] = piece;

  const path = state.path ? { ...state.path, squares: [...state.path.squares, legal.to] } :
    { color: state.turn, squares: [legal.from, legal.to], capture: legal.capture !== null, crowned: false, captured: 0 };
  if (legal.capture !== null) path.captured++;
  path.crowned = path.crowned || crowned;

  // Nhảy tiếp nếu còn quân để bắt — trừ khi vừa được phong vua (phong vua kết thúc lượt).
  const more = legal.capture !== null && !crowned && stepsFrom(board, legal.to).jumps.length > 0;
  if (more) return { board, turn: state.turn, forced: legal.to, path, moves: state.moves, result: null };

  const next = { board, turn: opponent(state.turn), forced: null, path: null, moves: [...state.moves, path], result: null };
  next.result = evaluate(next);
  return next;
}

/** Bên đến lượt thua nếu hết quân hoặc không còn nước đi hợp lệ. */
export function evaluate(state) {
  const pieces = state.board.filter((p) => colorOf(p) === state.turn).length;
  if (pieces === 0) return { winner: opponent(state.turn), reason: 'no-pieces' };
  if (legalSteps({ ...state, result: null }).length === 0) return { winner: opponent(state.turn), reason: 'no-moves' };
  return null;
}

export function notation(path) {
  return path.squares.map(squareNumber).join(path.capture ? '×' : '-');
}

export function countPieces(board) {
  const out = { b: 0, r: 0, bk: 0, rk: 0 };
  for (const p of board) {
    if (!p) continue;
    out[colorOf(p)]++;
    if (isKing(p)) out[`${colorOf(p)}k`]++;
  }
  return out;
}

export { colorOf, isKing, opponent };
