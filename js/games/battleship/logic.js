// Luật Bắn tàu (Battleship) — thuần JavaScript, không DOM, không p5.
// Hai bên: 'player' (người chơi) và 'bot'. Mỗi bên có hạm đội trên bàn 10×10.
// Trạng thái ván là dữ liệu JSON thuần; mọi hàm trả về trạng thái MỚI, không sửa trạng thái cũ.
import { createRng } from '../../cards/deck.js';

export const SIZE = 10;
export const COLS = 'ABCDEFGHIJ';
export const SHIPS = [
  { id: 'carrier', name: 'Tàu sân bay', size: 5 },
  { id: 'battleship', name: 'Thiết giáp hạm', size: 4 },
  { id: 'cruiser', name: 'Tuần dương hạm', size: 3 },
  { id: 'submarine', name: 'Tàu ngầm', size: 3 },
  { id: 'destroyer', name: 'Tàu khu trục', size: 2 },
];
export const SHIP_BY_ID = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
export const LEVELS = { easy: 'Dễ', medium: 'Trung bình' };
/** setup: đặt tàu · player: lượt người chơi · bot: lượt máy · won / lost: ván đã kết thúc. */
export const PHASES = ['setup', 'player', 'bot', 'won', 'lost'];

export const idx = (r, c) => r * SIZE + c;
export const rowOf = (cell) => Math.floor(cell / SIZE);
export const colOf = (cell) => cell % SIZE;
export const opponentOf = (side) => (side === 'player' ? 'bot' : 'player');
export const isOver = (state) => state.phase === 'won' || state.phase === 'lost';

/** Tên ô kiểu "D5": cột A–J, hàng 1–10. */
export function coordName(cell) {
  return `${COLS[colOf(cell)]}${rowOf(cell) + 1}`;
}

/* ---------- Đặt tàu ---------- */

/**
 * Các ô của một vị trí đặt tàu { id, r, c, dir: 'h' | 'v' } — (r, c) là đầu tàu,
 * tàu kéo dài sang phải (ngang) hoặc xuống dưới (dọc). Trả về null nếu tàu vượt khỏi bàn.
 */
export function shipCells(placement) {
  const ship = SHIP_BY_ID[placement.id];
  if (!ship) return null;
  const { r, c, dir } = placement;
  if (!Number.isInteger(r) || !Number.isInteger(c) || (dir !== 'h' && dir !== 'v')) return null;
  const cells = [];
  for (let k = 0; k < ship.size; k++) {
    const rr = dir === 'v' ? r + k : r;
    const cc = dir === 'h' ? c + k : c;
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return null;
    cells.push(idx(rr, cc));
  }
  return cells;
}

/** Các ô tàu chiếm, kể cả phần nằm ngoài bàn (dùng để vẽ vị trí dự kiến không hợp lệ). */
export function shipFootprint(placement) {
  const ship = SHIP_BY_ID[placement.id];
  const out = [];
  for (let k = 0; k < (ship?.size || 0); k++) {
    out.push({ r: placement.dir === 'v' ? placement.r + k : placement.r, c: placement.dir === 'h' ? placement.c + k : placement.c });
  }
  return out;
}

/**
 * Lý do vị trí không hợp lệ trong hạm đội `fleet` (bỏ qua tàu cùng id — tức là di chuyển tàu đó),
 * hoặc null nếu hợp lệ. Các tàu được phép chạm nhau (cạnh và góc), chỉ không được chồng lên nhau.
 */
export function placementError(fleet, placement) {
  if (!SHIP_BY_ID[placement?.id]) return 'unknown';
  const cells = shipCells(placement);
  if (!cells) return 'out';
  const taken = new Set();
  for (const other of fleet) {
    if (other.id === placement.id) continue;
    for (const cell of shipCells(other) || []) taken.add(cell);
  }
  return cells.some((cell) => taken.has(cell)) ? 'overlap' : null;
}

/** Hạm đội mới có thêm (hoặc dời) tàu; null nếu vị trí không hợp lệ. */
export function withShip(fleet, placement) {
  if (placementError(fleet, placement)) return null;
  const p = { id: placement.id, r: placement.r, c: placement.c, dir: placement.dir };
  const out = fleet.filter((s) => s.id !== p.id).concat(p);
  return SHIPS.map((s) => out.find((x) => x.id === s.id)).filter(Boolean);
}

export function withoutShip(fleet, id) {
  return fleet.filter((s) => s.id !== id);
}

/** Hạm đội hợp lệ và đủ năm tàu: đúng mỗi loại một chiếc, trong bàn, không chồng nhau. */
export function isFleetComplete(fleet) {
  return Array.isArray(fleet) && fleet.length === SHIPS.length && isFleetValid(fleet);
}

/** Hạm đội (có thể chưa đủ) hợp lệ: không trùng loại, không vượt bàn, không chồng nhau. */
export function isFleetValid(fleet) {
  if (!Array.isArray(fleet)) return false;
  const seen = new Set();
  const taken = new Set();
  for (const p of fleet) {
    if (!p || !SHIP_BY_ID[p.id] || seen.has(p.id)) return false;
    seen.add(p.id);
    const cells = shipCells(p);
    if (!cells) return false;
    for (const cell of cells) {
      if (taken.has(cell)) return false;
      taken.add(cell);
    }
  }
  return true;
}

/** Ô → id tàu chiếm ô đó (mảng 100 phần tử, null nếu là nước). */
export function occupancy(fleet) {
  const grid = new Array(SIZE * SIZE).fill(null);
  for (const p of fleet) for (const cell of shipCells(p) || []) grid[cell] = p.id;
  return grid;
}

/** Mọi vị trí hợp lệ của một tàu khi các ô trong `taken` đã bị chiếm. */
function candidatePlacements(id, taken) {
  const out = [];
  for (const dir of ['h', 'v']) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cells = shipCells({ id, r, c, dir });
        if (cells && cells.every((cell) => !taken.has(cell))) out.push({ id, r, c, dir, cells });
      }
    }
  }
  return out;
}

/**
 * Bố trí ngẫu nhiên đủ năm tàu. Không thử ngẫu nhiên vô hạn: với mỗi tàu (lớn trước), liệt kê MỌI vị trí
 * còn hợp lệ rồi chọn ngẫu nhiên một vị trí; nếu bế tắc thì quay lui sang vị trí khác.
 * Số vị trí là hữu hạn nên thuật toán luôn dừng (thực tế không bao giờ phải quay lui trên bàn 10×10).
 * `fixed`: các tàu đã đặt sẵn được giữ nguyên (đặt ngẫu nhiên phần còn lại).
 */
export function randomFleet(rng, fixed = []) {
  const keep = isFleetValid(fixed) ? fixed : [];
  const todo = SHIPS.filter((s) => !keep.some((p) => p.id === s.id)).map((s) => s.id);
  const taken = new Set(keep.flatMap((p) => shipCells(p)));
  const chosen = [];
  const place = (k) => {
    if (k === todo.length) return true;
    const options = candidatePlacements(todo[k], taken);
    // Xáo Fisher–Yates rồi thử lần lượt (quay lui nếu cần).
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    for (const opt of options) {
      opt.cells.forEach((cell) => taken.add(cell));
      chosen.push({ id: opt.id, r: opt.r, c: opt.c, dir: opt.dir });
      if (place(k + 1)) return true;
      chosen.pop();
      opt.cells.forEach((cell) => taken.delete(cell));
    }
    return false;
  };
  if (!place(0)) return null;
  const all = keep.map((p) => ({ id: p.id, r: p.r, c: p.c, dir: p.dir })).concat(chosen);
  return SHIPS.map((s) => all.find((p) => p.id === s.id));
}

/* ---------- Ván chơi ---------- */

/**
 * Ván mới ở giai đoạn đặt tàu. Máy tự đặt hạm đội (giữ kín) từ `seed`.
 * botRng: trạng thái bộ sinh số ngẫu nhiên của máy, lưu cùng ván để tải lại cho kết quả giống hệt.
 */
export function createGame({ level = 'medium', seed = 1 } = {}) {
  const rng = createRng(seed);
  return {
    level: level in LEVELS ? level : 'medium',
    seed,
    phase: 'setup',
    fleets: { player: [], bot: randomFleet(rng) },
    history: [],
    botRng: (Math.floor(rng() * 2 ** 32) >>> 0) || 1,
  };
}

/** Thay hạm đội người chơi (chỉ trong giai đoạn đặt tàu). Trả về null nếu không hợp lệ. */
export function setPlayerFleet(state, fleet) {
  if (state.phase !== 'setup' || !isFleetValid(fleet)) return null;
  return { ...state, fleets: { ...state.fleets, player: fleet.map((p) => ({ ...p })) } };
}

export function canStart(state) {
  return state.phase === 'setup' && isFleetComplete(state.fleets.player) && isFleetComplete(state.fleets.bot);
}

/** Bắt đầu trận: người chơi bắn trước. */
export function startBattle(state) {
  if (!canStart(state)) return null;
  return { ...state, phase: 'player' };
}

/** Các phát bắn nhắm vào hạm đội của `target` (do đối phương bắn), theo thứ tự. */
export function shotsAt(state, target) {
  const shooter = opponentOf(target);
  return state.history.filter((h) => h.by === shooter);
}

/** Tàu của `target` đã chìm, theo thứ tự bị đánh chìm. */
export function sunkShips(state, target) {
  return shotsAt(state, target).filter((h) => h.sunk).map((h) => h.sunk);
}

/** Số tàu còn nổi của `side`. */
export function shipsAfloat(state, side) {
  return SHIPS.length - sunkShips(state, side).length;
}

/**
 * Bắn vào ô `cell`. `shooter` phải đúng lượt; không được bắn ra ngoài bàn hoặc bắn lại ô đã bắn.
 * Trả về { ok: false, error } hoặc { ok: true, state, event }.
 * event: { by, cell, hit, sunk: id tàu vừa chìm | null, over }.
 * Lượt luôn chuyển sang đối phương sau mỗi phát, kể cả khi bắn trúng.
 */
export function fire(state, shooter, cell) {
  if (isOver(state)) return { ok: false, error: 'over' };
  if (state.phase !== shooter) return { ok: false, error: 'turn' };
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) return { ok: false, error: 'out' };
  const target = opponentOf(shooter);
  const previous = shotsAt(state, target);
  if (previous.some((h) => h.cell === cell)) return { ok: false, error: 'repeat' };

  const fleet = state.fleets[target];
  const ship = fleet.find((p) => shipCells(p).includes(cell));
  let sunk = null;
  if (ship) {
    const hitCells = new Set(previous.filter((h) => h.hit).map((h) => h.cell));
    hitCells.add(cell);
    if (shipCells(ship).every((c) => hitCells.has(c))) sunk = ship.id;
  }
  const event = { by: shooter, cell, hit: !!ship, sunk };
  const history = state.history.concat(event);
  const sunkCount = previous.filter((h) => h.sunk).length + (sunk ? 1 : 0);
  const over = sunkCount === SHIPS.length;
  const phase = over ? (shooter === 'player' ? 'won' : 'lost') : target;
  return { ok: true, state: { ...state, history, phase }, event: { ...event, over } };
}

/**
 * Dữ liệu QUAN SÁT CÔNG KHAI về bàn của `target`, đúng những gì bên bắn biết:
 * - grid: 100 ô 'unknown' | 'miss' | 'hit' (trúng, tàu chưa chìm) | 'sunk' (thuộc tàu đã chìm)
 * - sunk: [{ id, size, cells }] các tàu đã chìm (loại tàu và vị trí được công bố khi chìm)
 * - remaining: [{ id, size }] các tàu chưa chìm (thành phần hạm đội là chuẩn, ai cũng biết)
 * - shots: số phát đã bắn
 * Không chứa vị trí của tàu chưa chìm — đây là dữ liệu duy nhất được đưa cho máy khi chọn ô bắn.
 */
export function observe(state, target) {
  const shots = shotsAt(state, target);
  const grid = new Array(SIZE * SIZE).fill('unknown');
  for (const h of shots) grid[h.cell] = h.hit ? 'hit' : 'miss';
  const sunk = [];
  for (const h of shots) {
    if (!h.sunk) continue;
    const cells = shipCells(state.fleets[target].find((p) => p.id === h.sunk));
    for (const c of cells) grid[c] = 'sunk';
    sunk.push({ id: h.sunk, size: SHIP_BY_ID[h.sunk].size, cells });
  }
  const remaining = SHIPS.filter((s) => !sunk.some((x) => x.id === s.id)).map((s) => ({ id: s.id, size: s.size }));
  return { size: SIZE, grid, sunk, remaining, shots: shots.length };
}

/** Tình trạng từng tàu của chính `side` (chỉ dùng cho hạm đội của người xem): số ô bị trúng, đã chìm chưa. */
export function fleetDamage(state, side) {
  const hits = new Set(shotsAt(state, side).filter((h) => h.hit).map((h) => h.cell));
  return SHIPS.map((s) => {
    const p = state.fleets[side].find((x) => x.id === s.id);
    const cells = p ? shipCells(p) : [];
    const n = cells.filter((c) => hits.has(c)).length;
    return { ...s, placed: !!p, hits: n, sunk: !!p && n === s.size };
  });
}

/* ---------- Kiểm tra bản lưu ---------- */

/**
 * Kiểm tra dữ liệu đọc từ localStorage bằng cách chơi lại toàn bộ lịch sử bắn trên hai hạm đội:
 * mọi kết quả trúng/trượt/chìm và lượt phải khớp. Trả về trạng thái sạch hoặc null nếu bản lưu hỏng.
 */
export function validateGame(data) {
  if (!data || typeof data !== 'object' || !PHASES.includes(data.phase) || !(data.level in LEVELS)) return null;
  const fleets = data.fleets;
  if (!fleets || !isFleetComplete(fleets.bot) || !isFleetValid(fleets.player)) return null;
  if (!Array.isArray(data.history) || !Number.isInteger(data.botRng)) return null;
  let state = {
    level: data.level,
    seed: Number.isInteger(data.seed) ? data.seed : 0,
    phase: 'setup',
    fleets: { player: fleets.player.map((p) => ({ id: p.id, r: p.r, c: p.c, dir: p.dir })), bot: fleets.bot.map((p) => ({ id: p.id, r: p.r, c: p.c, dir: p.dir })) },
    history: [],
    botRng: data.botRng >>> 0,
  };
  if (data.phase === 'setup') return data.history.length ? null : state;
  state = startBattle(state);
  if (!state) return null;
  for (const h of data.history) {
    const res = fire(state, h?.by, h?.cell);
    if (!res.ok || res.event.hit !== h.hit || res.event.sunk !== (h.sunk ?? null)) return null;
    state = res.state;
  }
  return state.phase === data.phase ? state : null;
}
