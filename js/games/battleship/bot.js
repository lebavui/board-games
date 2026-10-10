// Thuật toán chọn ô bắn của máy. Chỉ nhận DỮ LIỆU QUAN SÁT CÔNG KHAI (xem observe() trong logic.js):
// lưới trúng/trượt/chìm, các tàu đã chìm và kích thước các tàu còn lại — không bao giờ nhận hạm đội bí mật.
// Hàm thuần: cùng quan sát + cùng trạng thái RNG => cùng ô bắn (nên tải lại trang không đổi nước đi).

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Một bước mulberry32 có trạng thái lưu được: trả về [số trong [0, 1), trạng thái mới]. */
export function rngStep(state) {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/**
 * Chọn ô bắn. obs: { size, grid, remaining: [{ size }] }, level: 'easy' | 'medium', rng: số nguyên 32 bit.
 * Trả về { cell, rng, mode } với rng là trạng thái mới; cell = -1 nếu không còn ô nào để bắn.
 * mode: 'random' (Dễ), 'target' (đang truy tàu bị trúng) hoặc 'hunt' (dò tìm theo ô bàn cờ).
 */
export function chooseShot(obs, level, rng) {
  const { size, grid } = obs;
  const unknown = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === 'unknown') unknown.push(i);
  if (!unknown.length) return { cell: -1, rng, mode: 'none' };
  const pick = (cells) => {
    const [x, next] = rngStep(rng);
    return { cell: cells[Math.floor(x * cells.length)], rng: next };
  };
  if (level === 'easy') return { ...pick(unknown), mode: 'random' };

  const target = targetCandidates(obs);
  if (target.length) return { ...pick(target), mode: 'target' };
  return { ...pick(huntCandidates(obs, unknown)), mode: 'hunt' };
}

const at = (size, r, c) => (r < 0 || c < 0 || r >= size || c >= size ? -1 : r * size + c);

/**
 * Có thể đặt một tàu còn lại theo trục (dr, dc) sao cho phủ cả ô `a` lẫn ô `b` (cùng hàng/cột),
 * chỉ đi qua ô chưa bắn hoặc ô trúng chưa thuộc tàu chìm? Trả về số cách đặt như vậy.
 * Không coi ô cạnh tàu đã chìm là chắc chắn trống — luật cho phép các tàu chạm nhau.
 */
function linePlacements(obs, a, b, dr, dc) {
  const { size, grid, remaining } = obs;
  const ra = Math.floor(a / size), ca = a % size, rb = Math.floor(b / size), cb = b % size;
  const lo = dr ? Math.min(ra, rb) : Math.min(ca, cb);
  const hi = dr ? Math.max(ra, rb) : Math.max(ca, cb);
  const fixed = dr ? ca : ra;
  let count = 0;
  for (const { size: len } of remaining) {
    for (let start = hi - len + 1; start <= lo; start++) {
      if (start < 0 || start + len > size) continue;
      let ok = true;
      for (let k = 0; k < len && ok; k++) {
        const cell = dr ? (start + k) * size + fixed : fixed * size + start + k;
        ok = grid[cell] === 'unknown' || grid[cell] === 'hit';
      }
      if (ok) count++;
    }
  }
  return count;
}

/**
 * Chế độ truy (target): các ô trúng chưa thuộc tàu chìm được giữ làm mục tiêu cho tới khi tàu chứa chúng chìm,
 * nên khi hai tàu nằm sát nhau, ô trúng của tàu thứ hai không bị bỏ quên sau khi tàu thứ nhất chìm.
 * Ưu tiên: (1) nối dài một dãy ≥ 2 ô trúng thẳng hàng theo trục của dãy;
 *          (2) ô liền kề bốn hướng của ô trúng (hướng vuông góc với dãy đã biết xếp sau).
 * Chỉ giữ ô mà ít nhất một tàu còn lại có thể nằm qua cả ô trúng lẫn ô đó; trong cùng mức ưu tiên,
 * chọn ô có nhiều cách đặt tàu nhất. Trả về [] nếu không còn ô mục tiêu nào => quay lại dò tìm.
 */
function targetCandidates(obs) {
  const { size, grid } = obs;
  const hits = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === 'hit') hits.push(i);
  if (!hits.length) return [];
  const score = new Map();
  const add = (cell, value) => { if (value > (score.get(cell) ?? -1)) score.set(cell, value); };
  const isHit = (cell) => cell >= 0 && grid[cell] === 'hit';

  for (const h of hits) {
    const r = Math.floor(h / size), c = h % size;
    for (const [dr, dc] of [[1, 0], [0, 1]]) {
      // Dãy ô trúng liên tiếp qua h theo trục này.
      let s = 0, e = 0;
      while (isHit(at(size, r - (s + 1) * dr, c - (s + 1) * dc))) s++;
      while (isHit(at(size, r + (e + 1) * dr, c + (e + 1) * dc))) e++;
      const runLen = s + e + 1;
      const first = at(size, r - s * dr, c - s * dc);
      const last = at(size, r + e * dr, c + e * dc);
      if (runLen >= 2) {
        for (const [sign, k] of [[-1, s], [1, e]]) {
          const cell = at(size, r + sign * (k + 1) * dr, c + sign * (k + 1) * dc);
          if (cell < 0 || grid[cell] !== 'unknown') continue;
          // Tàu phải phủ cả dãy ô trúng lẫn ô nối dài.
          const fits = linePlacements(obs, sign < 0 ? cell : first, sign < 0 ? last : cell, dr, dc);
          if (fits) add(cell, 3000 + runLen * 100 + fits);
        }
      }
      // Ô liền kề theo trục này (hai phía của h).
      const perpendicularToRun = hasRun(grid, size, r, c, dc, dr);
      for (const sign of [-1, 1]) {
        const cell = at(size, r + sign * dr, c + sign * dc);
        if (cell < 0 || grid[cell] !== 'unknown') continue;
        const fits = linePlacements(obs, h, cell, dr, dc);
        if (!fits) continue;
        add(cell, (perpendicularToRun ? 1000 : 2000) + fits);
      }
    }
  }
  if (!score.size) return [];
  const best = Math.max(...score.values());
  return [...score.keys()].filter((cell) => score.get(cell) === best).sort((a, b) => a - b);
}

/** h nằm trong một dãy ≥ 2 ô trúng theo trục (dr, dc)? */
function hasRun(grid, size, r, c, dr, dc) {
  for (const sign of [-1, 1]) {
    const cell = at(size, r + sign * dr, c + sign * dc);
    if (cell >= 0 && grid[cell] === 'hit') return true;
  }
  return false;
}

/**
 * Chế độ dò (hunt): chỉ bắn các ô màu "đen" của mẫu bàn cờ ((hàng + cột) chẵn) — mọi tàu dài ≥ 2 đều
 * phủ ít nhất một ô như vậy. Trong số đó ưu tiên ô có nhiều cách đặt tàu còn lại nhất (mật độ cao).
 * Nếu các ô bàn cờ đã hết chỗ cho tàu, dùng mọi ô còn chỗ; cuối cùng là mọi ô chưa bắn.
 */
function huntCandidates(obs, unknown) {
  const { size, grid, remaining } = obs;
  const density = new Map(unknown.map((cell) => [cell, 0]));
  for (const { size: len } of remaining) {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      for (let r = 0; r + dr * (len - 1) < size; r++) {
        for (let c = 0; c + dc * (len - 1) < size; c++) {
          const cells = [];
          for (let k = 0; k < len; k++) cells.push((r + dr * k) * size + c + dc * k);
          if (cells.every((cell) => grid[cell] === 'unknown')) for (const cell of cells) density.set(cell, density.get(cell) + 1);
        }
      }
    }
  }
  const parity = unknown.filter((cell) => (Math.floor(cell / size) + (cell % size)) % 2 === 0 && density.get(cell) > 0);
  const pool = parity.length ? parity : unknown.filter((cell) => density.get(cell) > 0);
  if (!pool.length) return unknown;
  // Giữ các ô có mật độ ≥ 70% mức cao nhất để máy không quá dễ đoán nhưng vẫn ưu tiên vùng rộng.
  const max = Math.max(...pool.map((cell) => density.get(cell)));
  return pool.filter((cell) => density.get(cell) >= max * 0.7);
}
