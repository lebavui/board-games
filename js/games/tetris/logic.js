// Logic Xếp gạch (kiểu Tetris). Trạng thái là đối tượng thuần (JSON) để lưu vào localStorage.
// Giếng 10 cột × 22 hàng: 2 hàng trên cùng ẩn (vùng xuất hiện), 20 hàng hiển thị. Ô i = hàng * COLS + cột,
// hàng 0 ở trên cùng. Ô trống là 0, ô đã khóa lưu chữ cái của khối (I, O, T, S, Z, J, L).
// Thời gian được truyền vào qua tick(game, dt) nên toàn bộ luật tất định và kiểm thử được.

export const COLS = 10;
export const ROWS = 22;
export const HIDDEN_ROWS = 2;
export const VISIBLE_ROWS = ROWS - HIDDEN_ROWS;
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const NEXT_COUNT = 5;
export const MAX_LEVEL = 20;
export const LOCK_DELAY = 500;      // ms chạm đáy trước khi khóa
export const MAX_LOCK_RESETS = 15;  // số lần di chuyển/xoay được gia hạn khóa khi đang chạm đáy
export const SOFT_DROP_FACTOR = 20;

// Hình khối ở trạng thái xoay 0 trong hộp n×n; các trạng thái khác có được bằng phép xoay hộp (đúng chuẩn SRS).
const BASE = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

const SHAPES = {};
for (const t of TYPES) {
  const { n, cells } = BASE[t];
  const states = [cells];
  for (let r = 1; r < 4; r++) states.push(states[r - 1].map(([x, y]) => [n - 1 - y, x]));
  SHAPES[t] = states;
}

/** Ô của khối `type` ở trạng thái xoay `rot`, tương đối với góc trên trái hộp. */
export function shapeCells(type, rot = 0) {
  return SHAPES[type][((rot % 4) + 4) % 4];
}

/** Ô tuyệt đối [cột, hàng] của một khối { type, rot, x, y }. */
export function pieceCells(piece) {
  return shapeCells(piece.type, piece.rot).map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
}

// Bảng đá tường SRS (dy đã đổi dấu: trục y hướng xuống). Khóa: "<trạng thái cũ><trạng thái mới>".
const flip = (list) => list.map(([dx, dy]) => [dx, -dy]);
const KICKS_JLSTZ = {
  '01': flip([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '10': flip([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  '12': flip([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  '21': flip([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '23': flip([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  '32': flip([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '30': flip([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '03': flip([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
};
const KICKS_I = {
  '01': flip([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  '10': flip([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  '12': flip([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
  '21': flip([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  '23': flip([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  '32': flip([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  '30': flip([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  '03': flip([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
};

// Điểm cơ bản (nhân với cấp độ) theo số hàng xóa.
const LINE_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [400, 800, 1200, 1600];

/** Thời gian (ms) để khối rơi một hàng ở cấp `level` — công thức của bộ hướng dẫn chuẩn. */
export function gravityInterval(level) {
  const l = Math.max(1, Math.min(MAX_LEVEL, level));
  return Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000;
}

/** Mulberry32 với trạng thái nằm trong ván để lưu/tải xong vẫn ra đúng dãy khối. */
function random(game) {
  let t = (game.rngState = (game.rngState + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Túi 7 khối: mỗi túi chứa đủ bảy loại theo thứ tự xáo Fisher–Yates. */
function refillQueue(game) {
  while (game.queue.length < NEXT_COUNT + 1) {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random(game) * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    game.queue.push(...bag);
  }
}

export function createGame({ startLevel = 1, seed = 1 } = {}) {
  const level = Math.max(1, Math.min(15, Math.floor(startLevel) || 1));
  const game = {
    board: new Array(COLS * ROWS).fill(0),
    piece: null,
    queue: [],
    hold: null,
    holdUsed: false,
    seed: seed | 0,
    rngState: seed | 0,
    startLevel: level,
    level,
    lines: 0,
    score: 0,
    pieces: 0,           // số khối đã khóa
    combo: -1,
    b2b: false,          // lần xóa hàng gần nhất là "khó" (Tetris hoặc T-spin có xóa hàng)
    fallAcc: 0,
    lockAcc: 0,
    lockResets: 0,
    lowestY: 0,
    lastRotate: false,   // thao tác thành công gần nhất là xoay (để nhận T-spin)
    lastClear: null,     // { lines, tspin, b2b, combo, points, at }
    elapsedMs: 0,
    status: 'ready',     // ready | playing | paused | over
  };
  refillQueue(game);
  spawn(game, game.queue.shift());
  return game;
}

function occupied(game, x, y) {
  if (x < 0 || x >= COLS || y >= ROWS) return true;
  if (y < 0) return false;
  return game.board[y * COLS + x] !== 0;
}

function fits(game, piece) {
  return pieceCells(piece).every(([x, y]) => !occupied(game, x, y));
}

function onGround(game) {
  return !fits(game, { ...game.piece, y: game.piece.y + 1 });
}

function spawn(game, type) {
  refillQueue(game);
  const piece = { type, rot: 0, x: type === 'O' ? 4 : 3, y: 0 };
  Object.assign(game, { piece, fallAcc: 0, lockAcc: 0, lockResets: 0, lastRotate: false });
  if (!fits(game, piece)) {
    game.status = 'over'; // chặn đầu: khối mới không có chỗ xuất hiện
    return false;
  }
  if (fits(game, { ...piece, y: piece.y + 1 })) piece.y++; // khối xuất hiện rồi rơi ngay một hàng
  game.lowestY = piece.y;
  return true;
}

/** Sau một thao tác thành công khi đang chạm đáy: gia hạn khóa (tối đa MAX_LOCK_RESETS lần). */
function afterAction(game) {
  if (game.piece.y > game.lowestY) {
    game.lowestY = game.piece.y;
    game.lockResets = 0;
  }
  if (game.lockResets < MAX_LOCK_RESETS && (game.lockAcc > 0 || onGround(game))) {
    game.lockAcc = 0;
    game.lockResets++;
  }
}

const canAct = (game) => game.status === 'playing' && game.piece;

export function move(game, dx) {
  if (!canAct(game)) return false;
  const next = { ...game.piece, x: game.piece.x + dx };
  if (!fits(game, next)) return false;
  game.piece = next;
  game.lastRotate = false;
  afterAction(game);
  return true;
}

/** Xoay theo chiều kim đồng hồ (dir = 1) hoặc ngược (dir = -1), thử lần lượt các vị trí đá tường SRS. */
export function rotate(game, dir) {
  if (!canAct(game)) return false;
  const { piece } = game;
  if (piece.type === 'O') return false;
  const to = (piece.rot + (dir > 0 ? 1 : 3)) % 4;
  const kicks = (piece.type === 'I' ? KICKS_I : KICKS_JLSTZ)[`${piece.rot}${to}`];
  for (const [dx, dy] of kicks) {
    const next = { ...piece, rot: to, x: piece.x + dx, y: piece.y + dy };
    if (fits(game, next)) {
      game.piece = next;
      game.lastRotate = true;
      afterAction(game);
      return true;
    }
  }
  return false;
}

/** Hàng thấp nhất khối hiện tại có thể rơi tới (để vẽ bóng khối). */
export function ghostY(game) {
  if (!game.piece) return 0;
  let y = game.piece.y;
  while (fits(game, { ...game.piece, y: y + 1 })) y++;
  return y;
}

export function hardDrop(game) {
  if (!canAct(game)) return false;
  const y = ghostY(game);
  game.score += 2 * (y - game.piece.y);
  if (y !== game.piece.y) game.lastRotate = false;
  game.piece = { ...game.piece, y };
  lock(game);
  return true;
}

/** Cất khối hiện tại vào ô giữ (mỗi khối chỉ được giữ một lần cho tới khi khóa). */
export function hold(game) {
  if (!canAct(game) || game.holdUsed) return false;
  const current = game.piece.type;
  const next = game.hold || game.queue.shift();
  game.hold = current;
  game.holdUsed = true;
  spawn(game, next);
  return true;
}

/** T-spin kiểu 3 góc: khối T vừa xoay và ít nhất 3/4 góc chéo quanh tâm bị chiếm (tường/đáy tính là chiếm). */
function isTSpin(game) {
  const { piece } = game;
  if (piece.type !== 'T' || !game.lastRotate) return false;
  const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
  return corners.filter(([dx, dy]) => occupied(game, piece.x + dx, piece.y + dy)).length >= 3;
}

function lock(game) {
  const { piece } = game;
  const tspin = isTSpin(game);
  const cells = pieceCells(piece);
  for (const [x, y] of cells) if (y >= 0) game.board[y * COLS + x] = piece.type;
  game.pieces++;
  game.piece = null;

  if (cells.every(([, y]) => y < HIDDEN_ROWS)) {
    game.status = 'over'; // khóa hoàn toàn ngoài vùng nhìn thấy
    return;
  }

  // Xóa hàng đầy, dồn các hàng phía trên xuống.
  const kept = [];
  let cleared = 0;
  for (let y = 0; y < ROWS; y++) {
    const row = game.board.slice(y * COLS, (y + 1) * COLS);
    if (row.every((v) => v !== 0)) cleared++;
    else kept.push(row);
  }
  if (cleared) game.board = [...new Array(cleared * COLS).fill(0), ...kept.flat()];

  const level = game.level;
  let points = (tspin ? TSPIN_POINTS : LINE_POINTS)[cleared] * level;
  let b2bBonus = false;
  if (cleared) {
    const difficult = cleared === 4 || tspin;
    if (difficult && game.b2b) {
      points = Math.floor(points * 1.5);
      b2bBonus = true;
    }
    game.b2b = difficult;
    game.combo++;
    if (game.combo > 0) points += 50 * game.combo * level;
  } else {
    game.combo = -1;
  }
  game.score += points;
  game.lines += cleared;
  game.level = Math.min(MAX_LEVEL, game.startLevel + Math.floor(game.lines / 10));
  game.holdUsed = false;
  if (cleared || tspin) {
    game.lastClear = { lines: cleared, tspin, b2b: b2bBonus, combo: Math.max(0, game.combo), points, at: game.elapsedMs };
  }
  spawn(game, game.queue.shift());
}

/**
 * Cho thời gian trôi `dt` ms: khối rơi theo trọng lực (nhanh gấp SOFT_DROP_FACTOR khi rơi nhanh,
 * mỗi hàng rơi nhanh +1 điểm) và tự khóa sau LOCK_DELAY ms chạm đáy. Trả về true nếu có khối vừa khóa.
 */
export function tick(game, dt, { softDrop = false } = {}) {
  if (!canAct(game) || !(dt > 0)) return false;
  const before = game.pieces;
  game.elapsedMs += dt;
  const base = gravityInterval(game.level);
  const interval = softDrop ? Math.min(base, base / SOFT_DROP_FACTOR) : base;
  game.fallAcc += dt;
  let rows = 0;
  while (game.fallAcc >= interval && rows < ROWS) {
    if (onGround(game)) {
      game.fallAcc = 0;
      break;
    }
    game.fallAcc -= interval;
    game.piece = { ...game.piece, y: game.piece.y + 1 };
    game.lastRotate = false;
    if (softDrop) game.score += 1;
    rows++;
  }
  if (rows) afterAction(game);
  if (onGround(game)) {
    game.lockAcc += dt;
    if (game.lockAcc >= LOCK_DELAY || game.lockResets >= MAX_LOCK_RESETS) lock(game);
  } else {
    game.lockAcc = 0;
  }
  return game.pieces !== before;
}

export function start(game) {
  if (game.status !== 'ready' && game.status !== 'paused') return false;
  game.status = 'playing';
  return true;
}

export function pause(game) {
  if (game.status !== 'playing') return false;
  game.status = 'paused';
  return true;
}

/** Kiểm tra dữ liệu đọc từ bản lưu; bản hỏng/không khớp thì trả false để bỏ qua. */
export function isValidState(g) {
  if (!g || typeof g !== 'object') return false;
  const isType = (t) => TYPES.includes(t);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!Array.isArray(g.board) || g.board.length !== COLS * ROWS) return false;
  if (!g.board.every((v) => v === 0 || isType(v))) return false;
  if (!Array.isArray(g.queue) || g.queue.length < NEXT_COUNT || !g.queue.every(isType)) return false;
  if (g.hold !== null && !isType(g.hold)) return false;
  if (!['ready', 'playing', 'paused', 'over'].includes(g.status)) return false;
  for (const k of ['rngState', 'startLevel', 'level', 'lines', 'score', 'pieces', 'combo', 'fallAcc', 'lockAcc', 'lockResets', 'lowestY', 'elapsedMs']) {
    if (!num(g[k])) return false;
  }
  if (g.status === 'over') return g.piece === null || typeof g.piece === 'object';
  const p = g.piece;
  if (!p || !isType(p.type) || ![0, 1, 2, 3].includes(p.rot) || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return false;
  return fits(g, p);
}
