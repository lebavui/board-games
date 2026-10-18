// Đối thủ máy cho Cờ tướng: negamax alpha-beta sâu dần theo thời gian + tìm kiếm tĩnh (chỉ xét nước ăn quân).
// Đi/hoàn nước trực tiếp trên một bản sao mảng bàn cờ, dùng chính bộ sinh nước trong logic.js.
import { COLS, colorOf, kindOf, opponent, pseudoMoves, inCheck, legalMoves, positionKey } from './logic.js';

export const AI_LEVELS = {
  easy: { label: 'Dễ', maxDepth: 2, timeMs: 300, noise: 80, blunder: 0.2 },
  medium: { label: 'Trung bình', maxDepth: 4, timeMs: 900, noise: 10, blunder: 0 },
  hard: { label: 'Khó', maxDepth: 20, timeMs: 2000, noise: 0, blunder: 0 },
};

const WIN = 100000;
const VALUE = { k: 0, r: 900, c: 450, n: 420, b: 200, a: 200, p: 100 };
class TimeUp extends Error {}

/** Điểm vị trí theo góc nhìn của bên Đỏ (hàng 0 là phía Đen); bên Đen dùng hàng đối xứng. */
function positional(kind, r, c) {
  const center = 4 - Math.abs(4 - c); // 0 ở mép, 4 ở cột giữa
  switch (kind) {
    case 'p': {
      if (r >= 5) return r === 6 && (c === 4) ? 5 : 0; // chưa qua sông
      const depth = 4 - r;                              // đã qua sông bao xa
      return 70 + depth * 12 + center * 6 - (r === 0 ? 40 : 0); // tốt đáy (sát hàng cuối) kém giá trị
    }
    case 'n': return center * 6 + (r <= 6 && r >= 2 ? 16 : 0) - (r === 9 ? 10 : 0);
    case 'c': return (r >= 7 ? 6 : 0) + (c === 4 ? 12 : 0) + center * 2;
    case 'r': return center * 3 + (r <= 4 ? 14 : 0);
    default: return 0;
  }
}

/** Đánh giá theo góc nhìn của `turn`. */
export function evaluateBoard(board, turn) {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    const p = board[i];
    if (!p) continue;
    const color = colorOf(p), kind = kindOf(p);
    const r = Math.floor(i / COLS), c = i % COLS;
    const v = VALUE[kind] + positional(kind, color === 'r' ? r : 9 - r, c);
    score += color === turn ? v : -v;
  }
  return score;
}

function orderMoves(board, flat, best) {
  const list = [];
  for (let k = 0; k < flat.length; k += 2) {
    const from = flat[k], to = flat[k + 1];
    const victim = board[to];
    let key = victim ? 10 * (VALUE[kindOf(victim)] || 1000) - VALUE[kindOf(board[from])] / 10 : 0;
    if (best && best.from === from && best.to === to) key = 1e7;
    list.push([key, from, to]);
  }
  return list.sort((a, b) => b[0] - a[0]);
}

function quiesce(board, turn, alpha, beta, ply, ctx) {
  if ((++ctx.n & 1023) === 0 && Date.now() > ctx.deadline) throw new TimeUp();
  const stand = evaluateBoard(board, turn);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (ply > 40) return stand;
  const flat = pseudoMoves(board, turn);
  for (const [key, from, to] of orderMoves(board, flat, null)) {
    if (key <= 0) break; // chỉ xét nước ăn quân
    const piece = board[from], captured = board[to];
    if (kindOf(captured) === 'k') return WIN - ply;
    board[to] = piece; board[from] = '';
    let score = -Infinity;
    if (!inCheck(board, turn)) score = -quiesce(board, opponent(turn), -beta, -alpha, ply + 1, ctx);
    board[from] = piece; board[to] = captured;
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function search(board, turn, depth, alpha, beta, ply, ctx) {
  if ((++ctx.n & 1023) === 0 && Date.now() > ctx.deadline) throw new TimeUp();
  const checked = inCheck(board, turn);
  if (checked) depth++; // gia hạn khi bị chiếu để không bỏ sót đòn chiếu bí
  if (depth <= 0) return quiesce(board, turn, alpha, beta, ply, ctx);
  const flat = pseudoMoves(board, turn);
  let best = -Infinity;
  for (const [, from, to] of orderMoves(board, flat, ctx.killer[ply])) {
    const piece = board[from], captured = board[to];
    board[to] = piece; board[from] = '';
    if (inCheck(board, turn)) { board[from] = piece; board[to] = captured; continue; }
    const score = -search(board, opponent(turn), depth - 1, -beta, -alpha, ply + 1, ctx);
    board[from] = piece; board[to] = captured;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      if (!captured) ctx.killer[ply] = { from, to };
      break;
    }
  }
  // Không còn nước hợp lệ: bị chiếu bí hoặc bị vây khốn — cả hai đều thua.
  if (best === -Infinity) return -WIN + ply;
  return best;
}

/** Chọn nước cho bên đang đi; trả về { from, to } hoặc null. */
export function chooseMove(state, levelId = 'medium', rng = Math.random) {
  const level = AI_LEVELS[levelId] || AI_LEVELS.medium;
  let moves = legalMoves(state);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (level.blunder && rng() < level.blunder) return moves[Math.floor(rng() * moves.length)];

  const board = state.board.slice();
  const turn = state.turn;
  const ctx = { n: 0, deadline: Date.now() + level.timeMs, killer: [] };
  // Nước tạo thế cờ đã gặp hai lần sẽ thành hòa: chấm 0 điểm (tránh khi đang hơn, tìm tới khi đang thua).
  const seen = new Map();
  for (const k of state.keys) seen.set(k, (seen.get(k) || 0) + 1);
  const repeats = (m) => {
    const piece = board[m.from], captured = board[m.to];
    board[m.to] = piece; board[m.from] = '';
    const key = positionKey(board, opponent(turn));
    board[m.from] = piece; board[m.to] = captured;
    return (seen.get(key) || 0) >= 2;
  };

  // Ưu tiên nước ăn quân giá trị cao ở vòng đầu.
  moves = orderMoves(board, moves.flatMap((m) => [m.from, m.to]), null).map(([, from, to]) => ({ from, to }));
  let best = moves[0];
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    try {
      const scored = [];
      let alpha = -Infinity;
      for (const m of moves) {
        const piece = board[m.from], captured = board[m.to];
        board[m.to] = piece; board[m.from] = '';
        const window = level.noise ? Infinity : -alpha;
        let score = -search(board, opponent(turn), depth - 1, -Infinity, window, 1, ctx);
        board[m.from] = piece; board[m.to] = captured;
        if (score > -WIN / 2 && score < WIN / 2 && repeats(m)) score = 0; // lặp lần ba = hòa
        if (level.noise) score += (rng() * 2 - 1) * level.noise;
        scored.push([score, m]);
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b[0] - a[0]);
      moves = scored.map((s) => s[1]);
      best = moves[0];
      if (scored[0][0] > WIN - 1000) break; // đã thấy chiếu bí
    } catch (e) {
      if (!(e instanceof TimeUp)) throw e;
      break;
    }
  }
  return best;
}

/** Ước lượng thế cờ cho bên `color` (dùng khi máy cân nhắc lời đề nghị hòa). */
export function evaluateFor(state, color) {
  return evaluateBoard(state.board, color);
}
