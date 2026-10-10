// Logic Sudoku: bộ giải đếm lời giải, bộ chấm độ khó theo kỹ thuật, bộ sinh đề và kiểm tra luật.
// Không phụ thuộc DOM/p5. Lưới là mảng 81 số (0 = ô trống), chỉ số i = hàng * 9 + cột.

export const DIFFICULTIES = {
  easy: { label: 'Dễ', minClues: 36 },
  medium: { label: 'Trung bình', minClues: 30 },
  hard: { label: 'Khó', minClues: 0 },
};

const ALL = 0x3fe; // bit 1..9

export const ROW = (i) => Math.floor(i / 9);
export const COL = (i) => i % 9;
export const BOX = (i) => Math.floor(ROW(i) / 3) * 3 + Math.floor(COL(i) / 3);

/** Các nhóm (hàng, cột, vùng) — 27 nhóm, mỗi nhóm 9 chỉ số. */
export const UNITS = (() => {
  const units = [];
  for (let r = 0; r < 9; r++) units.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) units.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    units.push([...Array(9)].map((_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  return units;
})();

/** PEERS[i]: 20 ô cùng hàng/cột/vùng với ô i. */
export const PEERS = (() => {
  const peers = [];
  for (let i = 0; i < 81; i++) {
    const set = new Set();
    for (let j = 0; j < 81; j++) {
      if (j !== i && (ROW(j) === ROW(i) || COL(j) === COL(i) || BOX(j) === BOX(i))) set.add(j);
    }
    peers.push([...set]);
  }
  return peers;
})();

const bitCount = (x) => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
const lowestDigit = (x) => 31 - Math.clz32(x & -x);
const digitsOf = (mask) => { const out = []; for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d); return out; };

/** Tạo bộ sinh số ngẫu nhiên có hạt giống (mulberry32), dùng cho kiểm thử tái lập. */
export function createRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Đếm số lời giải (dừng khi đạt `limit`). Backtracking với bitmask + chọn ô ít ứng viên nhất.
 * Trả về { count, solution } (solution là lời giải đầu tiên, hoặc null).
 */
export function countSolutions(grid, limit = 2, rng = null) {
  const g = grid.slice();
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = g[i];
    if (!v) continue;
    const bit = 1 << v;
    if ((rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]) & bit) return { count: 0, solution: null };
    rows[ROW(i)] |= bit; cols[COL(i)] |= bit; boxes[BOX(i)] |= bit;
  }
  let count = 0;
  let solution = null;

  function search() {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const mask = ALL & ~(rows[ROW(i)] | cols[COL(i)] | boxes[BOX(i)]);
      const n = bitCount(mask);
      if (n === 0) return false;
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = g.slice();
      return count >= limit;
    }
    const r = ROW(best), c = COL(best), b = BOX(best);
    const digits = digitsOf(bestMask);
    if (rng) shuffle(digits, rng);
    for (const d of digits) {
      const bit = 1 << d;
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      const stop = search();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (stop) return true;
    }
    return false;
  }

  search();
  return { count, solution };
}

export function generateSolvedGrid(rng) {
  return countSolutions(new Array(81).fill(0), 1, rng).solution;
}

/* ---------------- Bộ chấm độ khó bằng kỹ thuật logic ----------------
 * Mức 1: ô duy nhất (naked single) và vị trí duy nhất (hidden single).
 * Mức 2: thêm khóa ứng viên (pointing / claiming), cặp & bộ ba lộ (naked pair/triple),
 *        cặp ẩn (hidden pair).
 * Mức 3: không giải được bằng các kỹ thuật trên (cần kỹ thuật nâng cao hoặc thử sai).
 */
export function gradePuzzle(grid) {
  const values = grid.slice();
  const cand = new Array(81).fill(0);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    let mask = ALL;
    for (const p of PEERS[i]) if (values[p]) mask &= ~(1 << values[p]);
    cand[i] = mask;
  }
  let level = 1;
  let steps = 0;

  const place = (i, d) => {
    values[i] = d;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~(1 << d);
  };

  function singles() {
    for (let i = 0; i < 81; i++) {
      if (!values[i] && bitCount(cand[i]) === 1) { place(i, lowestDigit(cand[i])); return true; }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        let spot = -1, n = 0;
        for (const i of unit) if (!values[i] && cand[i] & bit) { spot = i; n++; }
        if (n === 1) { place(spot, d); return true; }
      }
    }
    return false;
  }

  function eliminate(cells, mask) {
    let changed = false;
    for (const i of cells) {
      if (!values[i] && cand[i] & mask) { cand[i] &= ~mask; changed = true; }
    }
    return changed;
  }

  function lockedCandidates() {
    // Pointing: trong một vùng, chữ số chỉ nằm trên một hàng/cột -> loại khỏi phần còn lại của hàng/cột.
    // Claiming: trong một hàng/cột, chữ số chỉ nằm trong một vùng -> loại khỏi phần còn lại của vùng.
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        const spots = unit.filter((i) => !values[i] && cand[i] & bit);
        if (spots.length < 2) continue;
        if (u >= 18) {
          const r = ROW(spots[0]), c = COL(spots[0]);
          if (spots.every((i) => ROW(i) === r) && eliminate(UNITS[r].filter((i) => !spots.includes(i)), bit)) return true;
          if (spots.every((i) => COL(i) === c) && eliminate(UNITS[9 + c].filter((i) => !spots.includes(i)), bit)) return true;
        } else {
          const b = BOX(spots[0]);
          if (spots.every((i) => BOX(i) === b) && eliminate(UNITS[18 + b].filter((i) => !spots.includes(i)), bit)) return true;
        }
      }
    }
    return false;
  }

  function nakedSubsets() {
    for (const unit of UNITS) {
      const open = unit.filter((i) => !values[i]);
      for (let a = 0; a < open.length; a++) {
        for (let b = a + 1; b < open.length; b++) {
          const pair = cand[open[a]] | cand[open[b]];
          if (bitCount(pair) === 2 && eliminate(open.filter((i) => i !== open[a] && i !== open[b]), pair)) return true;
          for (let c = b + 1; c < open.length; c++) {
            const triple = pair | cand[open[c]];
            if (bitCount(triple) === 3 &&
              eliminate(open.filter((i) => i !== open[a] && i !== open[b] && i !== open[c]), triple)) return true;
          }
        }
      }
    }
    return false;
  }

  function hiddenPairs() {
    for (const unit of UNITS) {
      const where = [];
      for (let d = 1; d <= 9; d++) where[d] = unit.filter((i) => !values[i] && cand[i] & (1 << d));
      for (let d1 = 1; d1 <= 9; d1++) {
        if (where[d1].length !== 2) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          if (where[d2].length !== 2 || where[d2][0] !== where[d1][0] || where[d2][1] !== where[d1][1]) continue;
          const keep = (1 << d1) | (1 << d2);
          let changed = false;
          for (const i of where[d1]) if (cand[i] & ~keep) { cand[i] &= keep; changed = true; }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  for (;;) {
    if (values.every((v) => v)) return { level, steps, solved: true };
    if (values.some((v, i) => !v && !cand[i])) return { level: 3, steps, solved: false };
    steps++;
    if (singles()) continue;
    if (lockedCandidates() || nakedSubsets() || hiddenPairs()) { level = Math.max(level, 2); continue; }
    return { level: 3, steps, solved: false };
  }
}

/**
 * Sinh đề có đúng một lời giải theo mức độ khó.
 * - Dễ: ≥ 36 số gợi ý, giải được chỉ bằng ô duy nhất/vị trí duy nhất (mức 1).
 * - Trung bình: 30–35 số gợi ý, giải được bằng kỹ thuật mức ≤ 2 (ưu tiên đề cần mức 2).
 * - Khó: xóa tối đa (đề tối giản, thường 22–28 số), ưu tiên đề cần kỹ thuật vượt mức 2.
 * Mỗi lần xóa ô đều kiểm tra lại bằng bộ giải để giữ tính duy nhất của lời giải.
 */
export function generatePuzzle(difficulty = 'easy', rng = createRng(), maxAttempts = 40) {
  const conf = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  let best = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolvedGrid(rng);
    const puzzle = solution.slice();
    let clues = 81;
    // Xóa theo cặp đối xứng tâm để đề cân đối.
    const order = shuffle([...Array(41).keys()], rng);
    for (const i of order) {
      const j = 80 - i;
      const removeCount = i === j ? 1 : 2;
      if (clues - removeCount < conf.minClues) continue;
      const a = puzzle[i], b = puzzle[j];
      puzzle[i] = 0; puzzle[j] = 0;
      if (countSolutions(puzzle, 2).count !== 1) { puzzle[i] = a; puzzle[j] = b; continue; }
      if (difficulty === 'easy' && gradePuzzle(puzzle).level > 1) { puzzle[i] = a; puzzle[j] = b; continue; }
      if (difficulty === 'medium' && gradePuzzle(puzzle).level > 2) { puzzle[i] = a; puzzle[j] = b; continue; }
      clues -= removeCount;
    }
    const grade = gradePuzzle(puzzle);
    const candidate = { puzzle, solution, clues, level: grade.level, difficulty };
    const target = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const okClues = difficulty === 'easy' ? clues <= 40 : difficulty === 'medium' ? clues <= 35 : true;
    if (grade.level === target && okClues) return candidate;
    // Giữ ứng viên gần mục tiêu nhất nếu hết số lần thử.
    const score = (c) => -Math.abs(c.level - target) * 100 - (difficulty === 'easy' ? 0 : c.clues);
    if (!best || score(candidate) > score(best)) best = candidate;
  }
  return best;
}

/** Ô vi phạm luật (trùng số trong hàng/cột/vùng). */
export function findConflicts(values) {
  const conflicts = new Set();
  for (const unit of UNITS) {
    const seen = new Map();
    for (const i of unit) {
      const v = values[i];
      if (!v) continue;
      if (seen.has(v)) { conflicts.add(i); conflicts.add(seen.get(v)); } else seen.set(v, i);
    }
  }
  return conflicts;
}

/** Hoàn thành khi bàn đầy và mọi hàng, cột, vùng chứa đủ 1–9. */
export function isComplete(values) {
  if (values.some((v) => !(v >= 1 && v <= 9))) return false;
  return UNITS.every((unit) => {
    let mask = 0;
    for (const i of unit) mask |= 1 << values[i];
    return mask === ALL;
  });
}

/** Ứng viên hợp lệ của ô i dựa trên các số hiện có. */
export function candidatesFor(values, i) {
  let mask = ALL;
  for (const p of PEERS[i]) if (values[p]) mask &= ~(1 << values[p]);
  return mask;
}
