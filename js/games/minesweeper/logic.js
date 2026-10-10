// Logic Dò mìn. Trạng thái là đối tượng thuần (JSON) để lưu vào localStorage.
// Ô được đánh chỉ số i = hàng * cols + cột.

export const LEVELS = {
  easy: { label: 'Dễ', cols: 9, rows: 9, mines: 10 },
  medium: { label: 'Trung bình', cols: 16, rows: 16, mines: 40 },
  hard: { label: 'Khó', cols: 30, rows: 16, mines: 99 },
};

export function createGame(levelId) {
  const level = LEVELS[levelId] || LEVELS.easy;
  const n = level.cols * level.rows;
  return {
    level: LEVELS[levelId] ? levelId : 'easy',
    cols: level.cols,
    rows: level.rows,
    mines: level.mines,
    mineAt: null,                  // mảng 0/1, tạo sau thao tác mở ô đầu tiên
    counts: null,                  // số mìn kề mỗi ô
    revealed: new Array(n).fill(0),
    flagged: new Array(n).fill(0),
    status: 'ready',               // ready | playing | won | lost
    exploded: -1,
    revealedCount: 0,
  };
}

export function neighbors(game, i) {
  const r = Math.floor(i / game.cols), c = i % game.cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < game.rows && cc < game.cols) out.push(rr * game.cols + cc);
    }
  }
  return out;
}

/** Đặt mìn sau lần mở đầu tiên: ô đầu tiên (và các ô kề nếu đủ chỗ) luôn an toàn. */
export function placeMines(game, safeIndex, rng = Math.random) {
  const n = game.cols * game.rows;
  const safe = new Set([safeIndex]);
  if (n - 9 >= game.mines) for (const j of neighbors(game, safeIndex)) safe.add(j);
  const pool = [];
  for (let i = 0; i < n; i++) if (!safe.has(i)) pool.push(i);
  for (let k = 0; k < game.mines; k++) {
    const j = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[j]] = [pool[j], pool[k]];
  }
  game.mineAt = new Array(n).fill(0);
  for (let k = 0; k < game.mines; k++) game.mineAt[pool[k]] = 1;
  game.counts = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (game.mineAt[i]) continue;
    game.counts[i] = neighbors(game, i).reduce((s, j) => s + game.mineAt[j], 0);
  }
  game.status = 'playing';
}

const isOver = (game) => game.status === 'won' || game.status === 'lost';

/** Mở một ô; tự mở lan vùng trống và viền số. Trả về true nếu bàn thay đổi. */
export function reveal(game, i, rng) {
  if (isOver(game) || game.revealed[i] || game.flagged[i]) return false;
  if (game.status === 'ready') placeMines(game, i, rng);
  if (game.mineAt[i]) {
    game.revealed[i] = 1;
    game.exploded = i;
    game.status = 'lost';
    return true;
  }
  const stack = [i];
  while (stack.length) {
    const j = stack.pop();
    if (game.revealed[j] || game.flagged[j]) continue;
    game.revealed[j] = 1;
    game.revealedCount++;
    if (game.counts[j] === 0) for (const k of neighbors(game, j)) if (!game.revealed[k] && !game.mineAt[k]) stack.push(k);
  }
  checkWin(game);
  return true;
}

/** Mở nhanh: bấm vào ô số đã đủ cờ xung quanh sẽ mở các ô kề còn lại. */
export function chord(game, i, rng) {
  if (isOver(game) || !game.revealed[i] || !game.counts || game.counts[i] === 0) return false;
  const around = neighbors(game, i);
  const flags = around.filter((j) => game.flagged[j]).length;
  if (flags !== game.counts[i]) return false;
  let changed = false;
  for (const j of around) {
    if (!game.revealed[j] && !game.flagged[j]) changed = reveal(game, j, rng) || changed;
    if (game.status === 'lost') break;
  }
  return changed;
}

export function toggleFlag(game, i) {
  if (isOver(game) || game.revealed[i]) return false;
  game.flagged[i] = game.flagged[i] ? 0 : 1;
  return true;
}

function checkWin(game) {
  if (game.revealedCount === game.cols * game.rows - game.mines) {
    game.status = 'won';
    // Tự cắm cờ các mìn còn lại khi thắng.
    game.mineAt.forEach((m, j) => { if (m) game.flagged[j] = 1; });
  }
}

export const flagCount = (game) => game.flagged.reduce((s, f) => s + f, 0);
export const minesLeft = (game) => game.mines - flagCount(game);
