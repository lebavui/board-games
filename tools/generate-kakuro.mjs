// Công cụ (chạy bằng Node) sinh đề Kakuro ứng viên có đúng một lời giải.
// Kết quả được kiểm tra lại bằng tests/kakuro.test.mjs trước khi đưa vào puzzles.js.
// Cách dùng: node tools/generate-kakuro.mjs <rows> <cols> <density 0..1> [seed] [số đề] [dãy dài tối đa]
// (rows/cols tính cả hàng/cột gợi ý đầu tiên; ví dụ 13 13 → vùng chơi 12×12.)
import { parsePuzzle, validateStructure, countSolutions } from '../js/games/kakuro/logic.js';

const [H = 8, W = 8, density = 0.72, seedArg = Date.now(), want = 1, maxRun = 9] = process.argv.slice(2).map(Number);
let seed = seedArg >>> 0;
function rand() { // mulberry32
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function makeLayout() {
  const g = Array.from({ length: H }, () => new Array(W).fill(false)); // true = trắng
  for (let r = 1; r < H; r++) for (let c = 1; c < W; c++) {
    const r2 = H - r, c2 = W - c; // đối xứng tâm trên vùng chơi (1..H-1)
    if (r2 < r || (r2 === r && c2 < c)) continue;
    const white = rand() < density;
    g[r][c] = white;
    if (r2 >= 1 && c2 >= 1) g[r2][c2] = white;
  }
  // Loại các ô thuộc dãy dài 1; cắt dãy dài hơn maxRun (đặt ô đen đối xứng ở giữa dãy).
  const setBlack = (r, c) => { g[r][c] = false; if (H - r >= 1 && W - c >= 1) g[H - r][W - c] = false; };
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = 1; r < H; r++) for (let c = 1; c < W; c++) {
      if (!g[r][c]) continue;
      const h = (g[r][c - 1] || (c + 1 < W && g[r][c + 1]));
      const v = (g[r - 1][c] || (r + 1 < H && g[r + 1][c]));
      if (!h || !v) { g[r][c] = false; changed = true; }
    }
    if (changed) continue;
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      for (let r = 1; r < H; r++) for (let c = 1; c < W; c++) {
        if (!g[r][c] || g[r - dr][c - dc]) continue; // chỉ xét ô đầu dãy
        let len = 0;
        while (r + len * dr < H && c + len * dc < W && g[r + len * dr][c + len * dc]) len++;
        if (len > maxRun) {
          const k = 2 + Math.floor(rand() * (len - 4));
          setBlack(r + k * dr, c + k * dc);
          changed = true;
        }
      }
    }
  }
  // Liên thông
  const whites = [];
  for (let r = 1; r < H; r++) for (let c = 1; c < W; c++) if (g[r][c]) whites.push([r, c]);
  if (whites.length < (H - 1) * (W - 1) * 0.5) return null;
  // Vùng chơi phải được dùng hết: hàng/cột ngoài cùng đều có ô trắng.
  if (!g[1].some(Boolean) || !g[H - 1].some(Boolean) || !g.some((row) => row[1]) || !g.some((row) => row[W - 1])) return null;
  const seen = new Set([whites[0].join()]);
  const stack = [whites[0]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr > 0 && cc > 0 && rr < H && cc < W && g[rr][cc] && !seen.has(`${rr},${cc}`)) { seen.add(`${rr},${cc}`); stack.push([rr, cc]); }
    }
  }
  if (seen.size !== whites.length) return null;
  return g;
}

function fill(g) {
  // Điền ngẫu nhiên lời giải không lặp số trong mỗi dãy.
  const rows = g.map((row) => row.map((w) => (w ? '1' : '#')).join(''));
  const model = parsePuzzle({ rows });
  if (validateStructure(model).length) return null;
  const val = g.map((row) => row.map(() => 0));
  const used = model.runs.map(() => 0);
  const order = model.whites;
  let steps = 0;
  function go(i) {
    if (++steps > 20000) return false;
    if (i === order.length) return true;
    const [r, c] = order[i];
    const { hRun, vRun } = model.cells[r][c];
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      const bit = 1 << d;
      if ((used[hRun] | used[vRun]) & bit) continue;
      used[hRun] |= bit; used[vRun] |= bit; val[r][c] = d;
      if (go(i + 1)) return true;
      used[hRun] &= ~bit; used[vRun] &= ~bit; val[r][c] = 0;
    }
    return false;
  }
  if (!go(0)) return null;
  return g.map((row, r) => row.map((w, c) => (w ? String(val[r][c]) : '#')).join(''));
}

// Tìm kiếm cục bộ: đổi chữ số tại ô mà hai lời giải khác nhau, giữ thay đổi nếu số lời giải không tăng.
// Giới hạn số nút tìm kiếm để bàn lớn không treo; vượt giới hạn coi như rất nhiều lời giải.
const LIMIT = 40;
const MAX_NODES = 300000;
function solve(rows) {
  const model = parsePuzzle({ rows });
  const sols = [];
  const res = countSolutions(model, LIMIT, (v) => { if (sols.length < 3) sols.push(v); }, MAX_NODES);
  return { model, count: res.aborted ? LIMIT + 1 : res.count, sols };
}
function mutate(rows, model, sols) {
  const grid = rows.map((r) => r.split(''));
  const diff = [];
  if (sols.length >= 2) model.whites.forEach(([r, c], i) => { if (sols[0][i] !== sols[1][i]) diff.push([r, c]); });
  const [r, c] = diff.length && rand() < 0.85 ? diff[Math.floor(rand() * diff.length)] : model.whites[Math.floor(rand() * model.whites.length)];
  const { hRun, vRun } = model.cells[r][c];
  let used = 0;
  for (const ri of [hRun, vRun]) for (const [a, b] of model.runs[ri].cells) if (a !== r || b !== c) used |= 1 << Number(grid[a][b]);
  const opts = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !(used & (1 << d)) && d !== Number(grid[r][c]));
  if (!opts.length) return null;
  grid[r][c] = String(opts[Math.floor(rand() * opts.length)]);
  return grid.map((x) => x.join(''));
}

let found = 0, tries = 0;
while (found < want && tries < 2000) {
  tries++;
  const g = makeLayout();
  if (!g) continue;
  let rows = fill(g);
  if (!rows) continue;
  let cur = solve(rows);
  for (let it = 0; it < 6000 && cur.count > 1; it++) {
    const next = mutate(rows, cur.model, cur.sols);
    if (!next) continue;
    const s = solve(next);
    if (s.count <= cur.count || rand() < 0.05) { rows = next; cur = s; }
  }
  if (cur.count === 1) {
    found++;
    console.log(JSON.stringify(rows, null, 2));
  }
}
if (!found) console.error('Không tìm được đề duy nhất');
