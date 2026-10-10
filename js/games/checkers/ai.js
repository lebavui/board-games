// Đối thủ máy cho Cờ đam: alpha-beta (negamax) sâu dần theo thời gian.
// Một "nước" của máy là trọn một lượt (gồm cả chuỗi nhảy liên tiếp), dùng chính luật trong logic.js.
import { legalSteps, applyStep, isKing, colorOf } from './logic.js';

export const AI_LEVELS = {
  easy: { label: 'Dễ', maxDepth: 2, timeMs: 300, noise: 60, blunder: 0.25 },
  medium: { label: 'Trung bình', maxDepth: 4, timeMs: 700, noise: 8, blunder: 0 },
  hard: { label: 'Khó', maxDepth: 14, timeMs: 1600, noise: 0, blunder: 0 },
};

const WIN = 100000;
class TimeUp extends Error {}

/** Mọi lượt đi hoàn chỉnh từ trạng thái: [{ steps: [{from,to}], state }]. */
export function turnMoves(state) {
  const out = [];
  const turn = state.turn;
  (function expand(s, steps) {
    for (const step of legalSteps(s)) {
      const next = applyStep(s, step);
      const path = [...steps, { from: step.from, to: step.to }];
      if (next.turn === turn && next.forced !== null && !next.result) expand(next, path);
      else out.push({ steps: path, state: next });
    }
  })(state, []);
  return out;
}

/** Đánh giá theo góc nhìn bên đang có lượt. */
export function evaluate(state) {
  if (state.result) return state.result.winner === state.turn ? WIN : state.result.winner ? -WIN : 0;
  let score = 0;
  let mine = 0, theirs = 0;
  state.board.forEach((p, i) => {
    if (!p) return;
    const color = colorOf(p);
    const r = Math.floor(i / 8), c = i % 8;
    let v;
    if (isKing(p)) {
      v = 175 - (Math.abs(3.5 - r) + Math.abs(3.5 - c)) * 2; // vua mạnh hơn ở trung tâm
    } else {
      const advance = color === 'b' ? r : 7 - r;
      v = 100 + advance * 4;
      if (advance === 0) v += 10;                     // giữ hàng cuối để chặn phong vua
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 4;
    }
    if (color === state.turn) { score += v; mine++; } else { score -= v; theirs++; }
  });
  // Khi đang hơn quân, khuyến khích đổi quân.
  if (mine !== theirs) score += (mine > theirs ? 1 : -1) * (24 - mine - theirs) * 3;
  return score;
}

function search(state, depth, alpha, beta, ply, deadline, counter) {
  if ((++counter.n & 255) === 0 && Date.now() > deadline) throw new TimeUp();
  if (state.result) return evaluate(state) + (state.result.winner === state.turn ? -ply : ply);
  const moves = turnMoves(state);
  // Không cắt ngang khi đang có nước bắt (tránh hiệu ứng chân trời).
  if (depth <= 0 && !(moves.length && moves[0].steps.length && legalSteps(state)[0]?.capture !== null)) return evaluate(state);
  if (depth <= -6) return evaluate(state);
  let best = -Infinity;
  moves.sort((a, b) => b.steps.length - a.steps.length);
  for (const m of moves) {
    const score = -search(m.state, depth - 1, -beta, -alpha, ply + 1, deadline, counter);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** Chọn lượt đi cho bên đang có lượt; trả về danh sách bước [{from,to}] hoặc null. */
export function chooseMove(state, levelId = 'medium', rng = Math.random) {
  const level = AI_LEVELS[levelId] || AI_LEVELS.medium;
  let moves = turnMoves(state);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0].steps;
  if (level.blunder && rng() < level.blunder) return moves[Math.floor(rng() * moves.length)].steps;

  const deadline = Date.now() + level.timeMs;
  const counter = { n: 0 };
  let best = moves[0];
  for (let depth = 1; depth <= level.maxDepth; depth++) {
    try {
      const scored = [];
      let alpha = -Infinity;
      for (const m of moves) {
        const window = level.noise ? Infinity : -alpha;
        let score = -search(m.state, depth - 1, -Infinity, window, 1, deadline, counter);
        if (level.noise) score += (rng() * 2 - 1) * level.noise;
        scored.push([score, m]);
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b[0] - a[0]);
      moves = scored.map((s) => s[1]);
      best = moves[0];
      if (scored[0][0] > WIN - 1000) break;
    } catch (e) {
      if (!(e instanceof TimeUp)) throw e;
      break;
    }
  }
  return best.steps;
}

/** Ước lượng thế cờ cho bên `color` (dùng khi máy cân nhắc lời đề nghị hòa). */
export function evaluateFor(state, color) {
  return evaluate({ ...state, result: null, turn: color });
}
