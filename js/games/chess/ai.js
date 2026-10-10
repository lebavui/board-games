// Đối thủ máy cho Cờ vua: alpha-beta (negamax) + tìm kiếm tĩnh (quiescence), sâu dần theo thời gian.
// Luật đi do chess.js cung cấp. Để đủ nhanh, bộ tìm kiếm dùng các hàm nội bộ của chess.js 1.0.0
// (_moves / _makeMove / _undoMove / _isKingAttacked — cùng cách hàm perft() của thư viện làm);
// phiên bản thư viện được cố định trong js/vendor nên các hàm này ổn định.
import { Chess } from '../../vendor/chess.js';

export const AI_LEVELS = {
  easy: { label: 'Dễ', maxDepth: 1, timeMs: 300, noise: 90, blunder: 0.2, quiescence: false },
  medium: { label: 'Trung bình', maxDepth: 3, timeMs: 700, noise: 12, blunder: 0, quiescence: true },
  hard: { label: 'Khó', maxDepth: 7, timeMs: 1800, noise: 0, blunder: 0, quiescence: true },
};

const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

// Bảng điểm vị trí (góc nhìn bên Trắng, chỉ số 0 = a8).
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  kEnd: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};

const toAlgebraic = (sq) => 'abcdefgh'[sq & 7] + (8 - (sq >> 4));

class TimeUp extends Error {}

/** Đánh giá tĩnh theo góc nhìn bên đang đi (centipawn). */
function evaluate(chess) {
  const board = chess._board;
  let score = 0, phase = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const pc = board[sq];
    if (pc && pc.type !== 'p' && pc.type !== 'k') phase += pc.type === 'q' ? 4 : pc.type === 'r' ? 2 : 1;
  }
  const endgame = phase <= 6;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const pc = board[sq];
    if (!pc) continue;
    const r = sq >> 4, f = sq & 7;
    const idx = pc.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
    const table = pc.type === 'k' && endgame ? PST.kEnd : PST[pc.type];
    const v = VALUE[pc.type] + table[idx];
    score += pc.color === 'w' ? v : -v;
  }
  return chess._turn === 'w' ? score : -score;
}

function orderMoves(moves, best) {
  const key = (m) => {
    if (best && m.from === best.from && m.to === best.to && m.promotion === best.promotion) return -1e6;
    let s = 0;
    if (m.captured) s -= 10 * VALUE[m.captured] - VALUE[m.piece] + 1000;
    if (m.promotion) s -= VALUE[m.promotion] + 800;
    return s;
  };
  return moves.map((m) => [key(m), m]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

export function createSearcher(chess, { timeMs, quiescence }) {
  const deadline = Date.now() + timeMs;
  let nodes = 0;
  const tick = () => { if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new TimeUp(); };

  function qsearch(alpha, beta, depthLeft) {
    tick();
    const stand = evaluate(chess);
    if (!quiescence || depthLeft <= 0) return stand;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    const us = chess._turn;
    const moves = orderMoves(chess._moves({ legal: false }).filter((m) => m.captured || m.promotion));
    for (const m of moves) {
      chess._makeMove(m);
      if (chess._isKingAttacked(us)) { chess._undoMove(); continue; }
      const score = -qsearch(-beta, -alpha, depthLeft - 1);
      chess._undoMove();
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(depth, alpha, beta, ply) {
    tick();
    if (depth <= 0) return qsearch(alpha, beta, 6);
    if (chess._halfMoves >= 100) return 0; // hòa theo quy tắc 50 nước
    const us = chess._turn;
    let legal = 0;
    let best = -Infinity;
    for (const m of orderMoves(chess._moves({ legal: false }))) {
      chess._makeMove(m);
      if (chess._isKingAttacked(us)) { chess._undoMove(); continue; }
      legal++;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      chess._undoMove();
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    if (legal === 0) return chess._isKingAttacked(us) ? -MATE + ply : 0;
    return best;
  }

  return { negamax, get nodes() { return nodes; } };
}

/**
 * Chọn nước đi cho bên đang có lượt.
 * @param {Array<{from,to,promotion?}>} history các nước đã đi từ thế ban đầu
 * @returns {{from,to,promotion?}|null}
 */
export function chooseMove(history, levelId = 'medium', rng = Math.random) {
  const level = AI_LEVELS[levelId] || AI_LEVELS.medium;
  const chess = new Chess();
  for (const m of history) chess.move(m);
  const us = chess._turn;
  const rootMoves = chess._moves({ legal: false }).filter((m) => {
    chess._makeMove(m);
    const ok = !chess._isKingAttacked(us);
    chess._undoMove();
    return ok;
  });
  if (!rootMoves.length) return null;
  const pack = (m) => ({ from: toAlgebraic(m.from), to: toAlgebraic(m.to), ...(m.promotion ? { promotion: m.promotion } : {}) });

  if (level.blunder && rng() < level.blunder) return pack(rootMoves[Math.floor(rng() * rootMoves.length)]);

  // Nước dẫn tới thế lặp lần thứ ba được tính là hòa (0 điểm).
  const repeats = new Set();
  for (const m of rootMoves) {
    const mv = chess.move(pack(m));
    if (chess.isThreefoldRepetition()) repeats.add(m);
    if (mv) chess.undo();
  }

  const searcher = createSearcher(chess, level);
  let ordered = orderMoves(rootMoves);
  let bestMove = ordered[0];
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    try {
      const scored = [];
      let alpha = -Infinity;
      for (const m of ordered) {
        chess._makeMove(m);
        // Có nhiễu (mức dễ) thì cần điểm chính xác cho mọi nước nên không cắt tỉa ở gốc.
        const window = level.noise ? Infinity : -alpha;
        let score = repeats.has(m) ? 0 : -searcher.negamax(depth - 1, -Infinity, window, 1);
        chess._undoMove();
        if (level.noise) score += (rng() * 2 - 1) * level.noise;
        scored.push([score, m]);
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b[0] - a[0]);
      ordered = scored.map((s) => s[1]);
      bestMove = ordered[0];
      if (scored[0][0] > MATE - 100) break; // đã tìm thấy chiếu hết
    } catch (e) {
      if (!(e instanceof TimeUp)) throw e;
      // Hết giờ giữa chừng: giữ kết quả của độ sâu đã hoàn thành.
      while (chess._history.length > history.length) chess._undoMove();
      break;
    }
  }
  return pack(bestMove);
}
