// Luật Cờ tướng (Xiangqi) trên bàn 9 cột × 10 hàng giao điểm.
// Bàn là mảng 90 phần tử, ô i = hàng * 9 + cột; hàng 0 ở trên (bên Đen), hàng 9 ở dưới (bên Đỏ). Đỏ đi trước.
// Quân dùng ký hiệu FEN: chữ hoa là Đỏ, chữ thường là Đen —
// K Tướng, A Sĩ, B Tượng, N Mã, R Xe, C Pháo, P Tốt; '' là giao điểm trống.

export const COLS = 9;
export const ROWS = 10;
export const COLOR_NAMES = { r: 'Đỏ', b: 'Đen' };
export const PIECE_NAMES = { k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt' };
const NOTATION_LETTERS = { k: 'Tg', a: 'S', b: 'T', n: 'M', r: 'X', c: 'P', p: 'B' };

export const NO_CAPTURE_LIMIT = 120;   // 60 nước mỗi bên không ăn quân → hòa
const START = [
  'rnbakabnr', '.........', '.c.....c.', 'p.p.p.p.p', '.........',
  '.........', 'P.P.P.P.P', '.C.....C.', '.........', 'RNBAKABNR',
];

export const colorOf = (piece) => (!piece ? null : piece === piece.toUpperCase() ? 'r' : 'b');
export const opponent = (color) => (color === 'r' ? 'b' : 'r');
export const kindOf = (piece) => piece.toLowerCase();
const rowOf = (i) => Math.floor(i / COLS);
const colOf = (i) => i % COLS;
const inBoard = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const inPalace = (color, r, c) => c >= 3 && c <= 5 && (color === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
const ownHalf = (color, r) => (color === 'r' ? r >= 5 : r <= 4);
const forward = (color) => (color === 'r' ? -1 : 1);

export function initialBoard() {
  return START.flatMap((row) => [...row].map((ch) => (ch === '.' ? '' : ch)));
}

export function initialState() {
  const board = initialBoard();
  return { board, turn: 'r', moves: [], keys: [positionKey(board, 'r')], quiet: 0, result: null };
}

export const positionKey = (board, turn) => board.map((p) => p || '.').join('') + turn;

const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const KNIGHT = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]];

/**
 * Nước đi giả hợp lệ (chưa xét tự để Tướng bị chiếu) của quân ở ô `from`; gọi `push(from, to)` cho từng nước.
 * Dùng chung cho giao diện và máy nên viết theo kiểu không tạo đối tượng.
 */
export function pieceMoves(board, from, push) {
  const piece = board[from];
  const color = colorOf(piece);
  const r = rowOf(from), c = colOf(from);
  const target = (rr, cc) => {
    const to = rr * COLS + cc;
    if (colorOf(board[to]) !== color) push(from, to);
  };
  switch (kindOf(piece)) {
    case 'k':
      for (const [dr, dc] of ORTHO) if (inPalace(color, r + dr, c + dc)) target(r + dr, c + dc);
      break;
    case 'a':
      for (const [dr, dc] of DIAG) if (inPalace(color, r + dr, c + dc)) target(r + dr, c + dc);
      break;
    case 'b':
      for (const [dr, dc] of DIAG) {
        const rr = r + 2 * dr, cc = c + 2 * dc;
        if (inBoard(rr, cc) && ownHalf(color, rr) && !board[(r + dr) * COLS + c + dc]) target(rr, cc); // không bị cản mắt tượng
      }
      break;
    case 'n':
      for (const [dr, dc] of KNIGHT) {
        const rr = r + dr, cc = c + dc;
        if (!inBoard(rr, cc)) continue;
        const leg = (r + (Math.abs(dr) === 2 ? Math.sign(dr) : 0)) * COLS + c + (Math.abs(dc) === 2 ? Math.sign(dc) : 0);
        if (!board[leg]) target(rr, cc); // không bị cản chân mã
      }
      break;
    case 'r':
      for (const [dr, dc] of ORTHO) {
        for (let rr = r + dr, cc = c + dc; inBoard(rr, cc); rr += dr, cc += dc) {
          const q = board[rr * COLS + cc];
          if (!q) { push(from, rr * COLS + cc); continue; }
          if (colorOf(q) !== color) push(from, rr * COLS + cc);
          break;
        }
      }
      break;
    case 'c':
      for (const [dr, dc] of ORTHO) {
        let screen = false;
        for (let rr = r + dr, cc = c + dc; inBoard(rr, cc); rr += dr, cc += dc) {
          const q = board[rr * COLS + cc];
          if (!screen) {
            if (!q) push(from, rr * COLS + cc);
            else screen = true; // gặp ngòi
          } else if (q) {
            if (colorOf(q) !== color) push(from, rr * COLS + cc); // ăn quân sau đúng một ngòi
            break;
          }
        }
      }
      break;
    case 'p': {
      const f = forward(color);
      if (inBoard(r + f, c)) target(r + f, c);
      if (!ownHalf(color, r)) { // đã qua sông: được đi ngang
        if (c > 0) target(r, c - 1);
        if (c < COLS - 1) target(r, c + 1);
      }
      break;
    }
  }
}

export function findKing(board, color) {
  const king = color === 'r' ? 'K' : 'k';
  const rows = color === 'r' ? [7, 8, 9] : [0, 1, 2];
  for (const r of rows) for (let c = 3; c <= 5; c++) if (board[r * COLS + c] === king) return r * COLS + c;
  return -1;
}

/** Tướng của `color` có đang bị chiếu không (kể cả hai Tướng đối mặt trên cùng cột không có quân cản). */
export function inCheck(board, color) {
  const k = findKing(board, color);
  if (k < 0) return true;
  const enemy = opponent(color);
  const r = rowOf(k), c = colOf(k);
  const isEnemy = (q, kind) => q && colorOf(q) === enemy && kindOf(q) === kind;

  // Xe, Pháo, Tướng đối mặt theo hàng/cột.
  for (const [dr, dc] of ORTHO) {
    let seen = 0;
    for (let rr = r + dr, cc = c + dc; inBoard(rr, cc); rr += dr, cc += dc) {
      const q = board[rr * COLS + cc];
      if (!q) continue;
      seen++;
      if (seen === 1) {
        if (isEnemy(q, 'r') || (dc === 0 && isEnemy(q, 'k'))) return true;
      } else {
        if (isEnemy(q, 'c')) return true;
        break;
      }
    }
  }
  // Mã: mã đối phương ở (r - dr, c - dc), chân mã nằm cạnh con mã theo hướng đi dài.
  for (const [dr, dc] of KNIGHT) {
    const nr = r - dr, nc = c - dc;
    if (!inBoard(nr, nc) || !isEnemy(board[nr * COLS + nc], 'n')) continue;
    const leg = (nr + (Math.abs(dr) === 2 ? Math.sign(dr) : 0)) * COLS + nc + (Math.abs(dc) === 2 ? Math.sign(dc) : 0);
    if (!board[leg]) return true;
  }
  // Tốt: tốt đối phương đứng ngay phía trước Tướng (theo hướng tiến của tốt), hoặc đứng ngang khi đã qua sông.
  const f = forward(enemy);
  if (inBoard(r - f, c) && isEnemy(board[(r - f) * COLS + c], 'p')) return true;
  for (const dc of [-1, 1]) {
    if (inBoard(r, c + dc) && isEnemy(board[r * COLS + c + dc], 'p') && !ownHalf(enemy, r)) return true;
  }
  return false;
}

/** Danh sách nước đi giả hợp lệ của `color` dạng [from, to, from, to, ...]. */
export function pseudoMoves(board, color, out = []) {
  const push = (from, to) => { out.push(from, to); };
  for (let i = 0; i < board.length; i++) if (board[i] && colorOf(board[i]) === color) pieceMoves(board, i, push);
  return out;
}

/** Thử đi trên chính mảng `board` rồi hoàn lại; true nếu sau nước đó Tướng mình không bị chiếu. */
export function isSafe(board, from, to) {
  const piece = board[from], captured = board[to];
  board[to] = piece;
  board[from] = '';
  const ok = !inCheck(board, colorOf(piece));
  board[from] = piece;
  board[to] = captured;
  return ok;
}

/** Các nước hợp lệ của bên đang đi: [{ from, to }]. */
export function legalMoves(state) {
  if (state.result) return [];
  const board = state.board.slice();
  const flat = pseudoMoves(board, state.turn);
  const out = [];
  for (let k = 0; k < flat.length; k += 2) if (isSafe(board, flat[k], flat[k + 1])) out.push({ from: flat[k], to: flat[k + 1] });
  return out;
}

export function hasLegalMove(board, color) {
  const b = board.slice();
  const flat = pseudoMoves(b, color);
  for (let k = 0; k < flat.length; k += 2) if (isSafe(b, flat[k], flat[k + 1])) return true;
  return false;
}

/** Hai bên đều không còn quân tấn công (Xe, Mã, Pháo, Tốt) thì không thể chiếu bí. */
export function insufficientMaterial(board) {
  return !board.some((p) => p && 'rncp'.includes(kindOf(p)));
}

/**
 * Ký hiệu kiểu Việt Nam: <quân><cột><hướng><số>, ví dụ "P2-5" (Pháo 2 bình 5), "M8.7" (Mã 8 tấn 7), "X1/2" (Xe 1 thoái 2).
 * Cột đánh số 1–9 từ phải sang trái theo phía người cầm quân. Hai quân cùng loại trên một cột: t (trước) / s (sau).
 */
export function notation(board, from, to) {
  const piece = board[from];
  const color = colorOf(piece);
  const kind = kindOf(piece);
  const file = (c) => (color === 'r' ? COLS - c : c + 1);
  const fr = rowOf(from), fc = colOf(from), tr = rowOf(to), tc = colOf(to);

  let head = NOTATION_LETTERS[kind] + file(fc);
  const same = [];
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + fc] === piece) same.push(r);
  if (same.length > 1 && kind !== 'k') {
    // Thứ tự từ phía trước (gần đối phương) ra sau.
    const order = color === 'r' ? same : same.slice().reverse();
    const pos = order.indexOf(fr);
    const tags = same.length === 2 ? ['t', 's'] : same.length === 3 ? ['t', 'g', 's'] : order.map((_, k) => String(k + 1));
    head = NOTATION_LETTERS[kind] + tags[pos];
  }
  if (tr === fr) return `${head}-${file(tc)}`;
  const advancing = (tr - fr) * forward(color) > 0;
  const diagonal = kind === 'n' || kind === 'b' || kind === 'a';
  return `${head}${advancing ? '.' : '/'}${diagonal ? file(tc) : Math.abs(tr - fr)}`;
}

/** Áp dụng nước đi (phải hợp lệ). Trả về trạng thái mới, không sửa trạng thái cũ; nước sai trả null. */
export function applyMove(state, move) {
  if (state.result) return null;
  const { from, to } = move;
  const piece = state.board[from];
  if (!piece || colorOf(piece) !== state.turn) return null;
  let ok = false;
  pieceMoves(state.board, from, (f, t) => { if (t === to) ok = true; });
  if (!ok || !isSafe(state.board.slice(), from, to)) return null;

  const board = state.board.slice();
  const captured = board[to];
  const record = { from, to, piece, captured, text: notation(board, from, to), check: false };
  board[to] = piece;
  board[from] = '';
  const turn = opponent(state.turn);
  record.check = inCheck(board, turn);
  const next = {
    board,
    turn,
    moves: [...state.moves, record],
    keys: [...state.keys, positionKey(board, turn)],
    quiet: captured ? 0 : state.quiet + 1,
    result: null,
  };
  next.result = evaluate(next);
  return next;
}

/** Kết quả sau nước vừa đi, hoặc null nếu ván tiếp tục. */
export function evaluate(state) {
  if (!hasLegalMove(state.board, state.turn)) {
    // Trong Cờ tướng, hết nước đi (bị vây khốn) cũng là thua như bị chiếu bí.
    return { winner: opponent(state.turn), reason: inCheck(state.board, state.turn) ? 'checkmate' : 'stalemate' };
  }
  const key = state.keys[state.keys.length - 1];
  if (state.keys.filter((k) => k === key).length >= 3) return { winner: null, reason: 'repetition' };
  if (state.quiet >= NO_CAPTURE_LIMIT) return { winner: null, reason: 'no-capture' };
  if (insufficientMaterial(state.board)) return { winner: null, reason: 'material' };
  return null;
}

/** Dựng lại trạng thái từ danh sách nước [{from, to}]; trả null nếu có nước không hợp lệ (bản lưu hỏng). */
export function replay(moves) {
  let state = initialState();
  for (const m of moves) {
    if (!m || !Number.isInteger(m.from) || !Number.isInteger(m.to)) return null;
    state = applyMove(state, m);
    if (!state) return null;
  }
  return state;
}

/** Quân đã bị ăn của mỗi bên (theo màu của quân bị ăn). */
export function capturedPieces(state) {
  const out = { r: [], b: [] };
  for (const m of state.moves) if (m.captured) out[colorOf(m.captured)].push(m.captured);
  return out;
}
