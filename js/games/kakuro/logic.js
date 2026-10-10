// Logic Kakuro: phân tích đề, dãy ô, kiểm tra và bộ giải đếm lời giải.
// Không phụ thuộc DOM hay p5 để chạy được cả trong trình duyệt lẫn Node (kiểm thử).

/**
 * Đề được lưu dạng lưới chuỗi: '#' là ô đen, '1'–'9' là ô trắng kèm chữ số lời giải.
 * Tổng gợi ý được suy ra từ lời giải; bộ giải chỉ dùng các tổng này (không nhìn lời giải)
 * để xác minh đề có đúng một lời giải.
 */
export function parsePuzzle(def) {
  const height = def.rows.length;
  const width = def.rows[0].length;
  const cells = [];
  for (let r = 0; r < height; r++) {
    const row = [];
    for (let c = 0; c < width; c++) {
      const ch = def.rows[r][c];
      if (ch === '#') row.push({ type: 'block', right: 0, down: 0 });
      else row.push({ type: 'white', solution: Number(ch) });
    }
    cells.push(row);
  }

  const isWhite = (r, c) => r >= 0 && c >= 0 && r < height && c < width && cells[r][c].type === 'white';
  const runs = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (isWhite(r, c)) continue;
      for (const [dir, dr, dc] of [['right', 0, 1], ['down', 1, 0]]) {
        const list = [];
        let rr = r + dr, cc = c + dc;
        while (isWhite(rr, cc)) { list.push([rr, cc]); rr += dr; cc += dc; }
        if (list.length === 0) continue;
        const sum = list.reduce((s, [a, b]) => s + cells[a][b].solution, 0);
        cells[r][c][dir] = sum;
        cells[r][c].type = 'clue';
        runs.push({ dir, clue: [r, c], cells: list, sum });
      }
    }
  }
  // Gắn chỉ số dãy ngang/dọc cho từng ô trắng.
  runs.forEach((run, i) => {
    for (const [r, c] of run.cells) cells[r][c][run.dir === 'right' ? 'hRun' : 'vRun'] = i;
  });
  const whites = [];
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) if (isWhite(r, c)) whites.push([r, c]);
  return { id: def.id, name: def.name, difficulty: def.difficulty, width, height, cells, runs, whites };
}

/** Kiểm tra cấu trúc: mọi ô trắng thuộc một dãy ngang và một dãy dọc dài ≥ 2, dãy ≤ 9 ô. */
export function validateStructure(model) {
  const errors = [];
  for (const run of model.runs) {
    if (run.cells.length < 2) errors.push(`Dãy ${run.dir} tại ${run.clue} chỉ có 1 ô`);
    if (run.cells.length > 9) errors.push(`Dãy ${run.dir} tại ${run.clue} dài hơn 9 ô`);
  }
  for (const [r, c] of model.whites) {
    const cell = model.cells[r][c];
    if (cell.hRun === undefined || cell.vRun === undefined) errors.push(`Ô (${r},${c}) thiếu dãy`);
  }
  return errors;
}

const MASK_ALL = 0b1111111110; // bit 1..9

function popcount(x) { let n = 0; while (x) { x &= x - 1; n++; } return n; }

// COMBO_MASKS[len][sum] = danh sách bitmask các tổ hợp `len` chữ số khác nhau có tổng `sum`.
const COMBO_MASKS = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let m = 2; m <= MASK_ALL; m += 2) {
  let sum = 0;
  for (let d = 1; d <= 9; d++) if (m & (1 << d)) sum += d;
  COMBO_MASKS[popcount(m)][sum].push(m);
}

/**
 * Đếm số lời giải chỉ dựa trên tổng gợi ý (dừng khi đạt `limit`).
 * Ứng viên của một ô = các chữ số còn nằm trong ít nhất một tổ hợp hợp lệ của cả dãy ngang lẫn dọc.
 * `maxNodes` (tùy chọn) giới hạn số nút tìm kiếm; khi vượt, trả về aborted = true.
 * Trả về { count, solution, aborted } với solution là lời giải đầu tiên tìm được (mảng theo model.whites).
 */
export function countSolutions(model, limit = 2, onSolution = null, maxNodes = Infinity) {
  const { runs, whites, cells } = model;
  const n = whites.length;
  const value = new Array(n).fill(0);
  const cellRuns = whites.map(([r, c]) => [cells[r][c].hRun, cells[r][c].vRun]);
  const runCombos = runs.map((run) => (run.cells.length <= 9 && run.sum <= 45 ? COMBO_MASKS[run.cells.length][run.sum] : []));
  const runUsed = runs.map(() => 0);
  let count = 0;
  let first = null;
  let nodes = 0;
  let aborted = false;

  // Hợp các tổ hợp còn chứa toàn bộ chữ số đã dùng, trừ đi các chữ số đã dùng.
  function runAllowed(ri) {
    const used = runUsed[ri];
    let allowed = 0;
    for (const m of runCombos[ri]) if ((m & used) === used) allowed |= m;
    return allowed & ~used;
  }

  function search(filled) {
    if (++nodes > maxNodes) { aborted = true; return true; }
    if (filled === n) {
      count++;
      if (!first) first = value.slice();
      if (onSolution) onSolution(value.slice());
      return count >= limit;
    }
    const allowed = runs.map((_, ri) => runAllowed(ri));
    // Chọn ô có ít ứng viên nhất (MRV).
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < n; i++) {
      if (value[i]) continue;
      const m = allowed[cellRuns[i][0]] & allowed[cellRuns[i][1]];
      const k = popcount(m);
      if (k === 0) return false;
      if (k < bestCount) { best = i; bestMask = m; bestCount = k; if (k === 1) break; }
    }
    for (let d = 1; d <= 9; d++) {
      if (!(bestMask & (1 << d))) continue;
      value[best] = d;
      for (const ri of cellRuns[best]) runUsed[ri] |= 1 << d;
      const stop = search(filled + 1);
      for (const ri of cellRuns[best]) runUsed[ri] &= ~(1 << d);
      value[best] = 0;
      if (stop) return true;
    }
    return false;
  }

  search(0);
  return { count, solution: first, aborted };
}

/** Xác minh đầy đủ một đề: cấu trúc hợp lệ, đúng một lời giải và trùng lời giải lưu kèm. */
export function verifyPuzzle(def) {
  const model = parsePuzzle(def);
  const errors = validateStructure(model);
  if (errors.length) return { ok: false, errors };
  const { count, solution } = countSolutions(model, 2);
  if (count !== 1) return { ok: false, errors: [`Đề có ${count === 0 ? 0 : '≥ 2'} lời giải`] };
  const matches = model.whites.every(([r, c], i) => model.cells[r][c].solution === solution[i]);
  if (!matches) return { ok: false, errors: ['Lời giải tìm được khác lời giải lưu kèm'] };
  return { ok: true, errors: [] };
}

/** Trạng thái các dãy với giá trị người chơi nhập: trùng số, sai tổng (khi dãy đầy). */
export function analyzeEntries(model, values) {
  const conflicts = new Set();
  const runState = model.runs.map((run) => {
    const seen = new Map();
    let sum = 0, filled = 0;
    for (const [r, c] of run.cells) {
      const v = values[r][c];
      if (!v) continue;
      sum += v; filled++;
      if (seen.has(v)) { conflicts.add(`${r},${c}`); conflicts.add(seen.get(v)); }
      else seen.set(v, `${r},${c}`);
    }
    const full = filled === run.cells.length;
    const wrongSum = full ? sum !== run.sum : sum >= run.sum && filled < run.cells.length;
    return { full, sum, wrongSum, satisfied: full && sum === run.sum && seen.size === filled };
  });
  return { conflicts, runState };
}

/** Thắng khi mọi ô có số, mọi dãy đúng tổng và không lặp chữ số. */
export function isSolved(model, values) {
  for (const [r, c] of model.whites) if (!values[r][c]) return false;
  const { conflicts, runState } = analyzeEntries(model, values);
  return conflicts.size === 0 && runState.every((s) => s.satisfied);
}

/** Các tổ hợp chữ số khác nhau (tăng dần) có `len` phần tử và tổng `sum` — dùng để trợ giúp người chơi. */
export function combinations(sum, len) {
  const out = [];
  (function rec(start, left, remain, acc) {
    if (left === 0) { if (remain === 0) out.push(acc.slice()); return; }
    for (let d = start; d <= 9 && d <= remain; d++) { acc.push(d); rec(d + 1, left - 1, remain - d, acc); acc.pop(); }
  })(1, len, sum, []);
  return out;
}
