// Đối thủ máy cho Cờ caro (luật tự do).
// - Chấm điểm từng giao điểm theo mẫu quân trên 4 hướng (năm, bốn mở, bốn, ba mở, ba, hai…)
//   cho cả tấn công lẫn phòng thủ.
// - Mức Khó thêm tìm kiếm VCF (thắng bằng chuỗi nước "bốn" liên tiếp buộc đối thủ chặn)
//   cho mình và cho đối thủ để chặn trước các đòn ép.
import { SIZE } from './logic.js';

export const AI_LEVELS = {
  easy: { label: 'Dễ', defense: 0.55, topK: 5, vcfDepth: 0 },
  medium: { label: 'Trung bình', defense: 0.9, topK: 1, vcfDepth: 0 },
  hard: { label: 'Khó', defense: 0.95, topK: 1, vcfDepth: 10 },
};

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const N = SIZE * SIZE;

const R = { FIVE: 6, OPEN4: 5, FOUR: 4, OPEN3: 3, THREE: 2, OPEN2: 1, NONE: 0 };
// Mẫu theo thứ tự ưu tiên; 'x' quân mình, '_' trống. Mẫu phải phủ ô đang xét.
const PATTERNS = [
  [R.FIVE, ['xxxxx']],
  [R.OPEN4, ['_xxxx_']],
  [R.FOUR, ['xxxx_', '_xxxx', 'xxx_x', 'xx_xx', 'x_xxx']],
  [R.OPEN3, ['_xxx__', '__xxx_', '_xx_x_', '_x_xx_']],
  [R.THREE, ['xxx__', '__xxx', '_xxx_', 'xx_x_', '_x_xx', 'x_xx_', '_xx_x', 'xx__x', 'x__xx', 'x_x_x']],
  [R.OPEN2, ['__xx__', '_xx__', '__xx_', '_x_x_', '_x__x_']],
];
const RANK_SCORE = [0, 40, 400, 3000, 20000, 1e6, 1e8];

/** Chuỗi 9 ký tự quanh ô i theo hướng (dr, dc), coi ô i là quân của `color`. */
function lineAround(board, i, dr, dc, color) {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  let s = '';
  for (let k = -4; k <= 4; k++) {
    if (k === 0) { s += 'x'; continue; }
    const rr = r + dr * k, cc = c + dc * k;
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) { s += 'o'; continue; }
    const v = board[rr * SIZE + cc];
    s += v === 0 ? '_' : v === color ? 'x' : 'o';
  }
  return s;
}

function rankOfLine(s) {
  for (const [rank, list] of PATTERNS) {
    for (const p of list) {
      for (let start = Math.max(0, 4 - p.length + 1); start <= 4 && start + p.length <= 9; start++) {
        if (s.startsWith(p, start) && p[4 - start] === 'x') return rank;
      }
    }
  }
  return R.NONE;
}

/** Điểm khi `color` đặt quân tại ô trống i. */
export function cellScore(board, i, color) {
  let score = 0, fours = 0, open3 = 0;
  for (const [dr, dc] of DIRS) {
    const rank = rankOfLine(lineAround(board, i, dr, dc, color));
    if (rank === R.FIVE) return RANK_SCORE[R.FIVE];
    if (rank === R.OPEN4 || rank === R.FOUR) fours += rank === R.OPEN4 ? 2 : 1;
    if (rank === R.OPEN3) open3++;
    score += RANK_SCORE[rank];
  }
  if (fours >= 2) return Math.max(score, 1e7);          // bốn mở hoặc bốn kép: thắng chắc
  if (fours >= 1 && open3 >= 1) return Math.max(score, 5e6); // bốn + ba mở
  if (open3 >= 2) return Math.max(score, 1e6);          // ba mở kép
  return score;
}

function candidates(board, radius = 2) {
  const out = [];
  let any = false;
  for (let i = 0; i < N; i++) {
    if (board[i]) { any = true; continue; }
    const r = Math.floor(i / SIZE), c = i % SIZE;
    let near = false;
    for (let dr = -radius; dr <= radius && !near; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && board[rr * SIZE + cc]) { near = true; break; }
      }
    }
    if (near) out.push(i);
  }
  if (!any) return [Math.floor(N / 2)];
  return out;
}

function makesFive(board, i, color) {
  for (const [dr, dc] of DIRS) if (rankOfLine(lineAround(board, i, dr, dc, color)) === R.FIVE) return true;
  return false;
}

/** Các ô mà `color` đặt vào sẽ có năm quân. */
function fiveCells(board, color) {
  return candidates(board, 1).filter((i) => makesFive(board, i, color));
}

/**
 * VCF: tìm nước "bốn" mở đầu chuỗi thắng ép buộc cho `me`. Trả về chỉ số ô hoặc -1.
 * Đối thủ bị buộc chặn ô duy nhất hoàn thành năm; nếu nước chặn tạo bốn/năm cho đối thủ thì bỏ nhánh.
 */
export function findVCF(board, me, depth, deadline = Infinity) {
  if (depth <= 0 || Date.now() > deadline) return -1;
  const opp = me === 1 ? 2 : 1;
  const myFives = fiveCells(board, me);
  if (myFives.length) return myFives[0];
  if (fiveCells(board, opp).length) return -1; // đối thủ đang dọa năm: không còn là chuỗi ép buộc
  for (const i of candidates(board, 2)) {
    const s = cellScore(board, i, me);
    if (s < RANK_SCORE[R.FOUR]) continue;
    board[i] = me;
    const wins = fiveCells(board, me);
    let result = -1;
    if (wins.length >= 2) result = i; // hai điểm thắng: đối thủ không chặn kịp
    else if (wins.length === 1) {
      const block = wins[0];
      board[block] = opp;
      const counter = fiveCells(board, opp).length > 0;
      if (!counter && findVCF(board, me, depth - 1, deadline) !== -1) result = i;
      board[block] = 0;
    }
    board[i] = 0;
    if (result !== -1) return result;
  }
  return -1;
}

/**
 * Chọn nước đi cho `me` (1 = Đen, 2 = Trắng).
 * @param {number[]} board mảng 225 phần tử (0 trống, 1 Đen, 2 Trắng)
 */
export function chooseMove(board, me, levelId = 'medium', rng = Math.random) {
  const level = AI_LEVELS[levelId] || AI_LEVELS.medium;
  const b = board.slice();
  const opp = me === 1 ? 2 : 1;
  const cands = candidates(b);
  if (cands.length === 1 && !b.some((v) => v)) return cands[0];

  const scored = cands.map((i) => {
    const attack = cellScore(b, i, me);
    const defense = cellScore(b, i, opp);
    return { i, attack, defense, total: attack + defense * level.defense + rng() * 5 };
  }).sort((x, y) => y.total - x.total);

  // Luôn thắng ngay nếu có thể.
  const win = scored.find((s) => s.attack >= RANK_SCORE[R.FIVE]);
  if (win) return win.i;

  if (level.vcfDepth) {
    const deadline = Date.now() + 1500;
    // Phải chặn năm của đối thủ trước.
    const mustBlock = scored.find((s) => s.defense >= RANK_SCORE[R.FIVE]);
    if (mustBlock) return mustBlock.i;
    const myVcf = findVCF(b, me, level.vcfDepth, deadline);
    if (myVcf !== -1) return myVcf;
    // Nếu đối thủ có VCF, chọn nước (trong các nước tốt nhất) phá được chuỗi đó.
    if (findVCF(b, opp, level.vcfDepth, deadline) !== -1) {
      for (const s of scored.slice(0, 12)) {
        b[s.i] = me;
        const stillLoses = findVCF(b, opp, level.vcfDepth, deadline) !== -1;
        b[s.i] = 0;
        if (!stillLoses) return s.i;
      }
    }
    // Nhìn trước một nước: tránh nước để đối thủ có thế thắng chắc ngay sau đó.
    const top = scored.slice(0, 8).map((s) => {
      b[s.i] = me;
      let worst = 0;
      for (const j of candidates(b)) worst = Math.max(worst, cellScore(b, j, opp));
      b[s.i] = 0;
      const danger = worst >= 1e6 ? worst : 0;
      return { i: s.i, value: s.total - danger };
    }).sort((x, y) => y.value - x.value);
    return top[0].i;
  }

  if (level.topK > 1) {
    // Mức Dễ: đôi khi bỏ sót phòng thủ, chọn ngẫu nhiên trong vài nước tốt.
    const mustBlock = scored.find((s) => s.defense >= RANK_SCORE[R.FIVE]);
    if (mustBlock && rng() < 0.8) return mustBlock.i;
    const pool = scored.slice(0, level.topK);
    return pool[Math.floor(rng() * pool.length)].i;
  }
  return scored[0].i;
}
