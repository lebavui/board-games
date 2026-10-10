// Điều khiển trang Bắn tàu: giai đoạn đặt tàu, nhận phát bắn, hiệu ứng, nhật ký và lưu ván.
// Luật nằm trong logic.js, thuật toán máy trong bot.js, việc lên lịch lượt máy trong match.js.
import { initPage, confirmDialog, resultDialog, bindActions, el, toast } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createRng, randomSeed } from '../../cards/deck.js';
import * as L from './logic.js';
import { createMatch } from './match.js';
import { createSeaBoard, drawSea, effectDuration } from './view.js';

const SAVE_KEY = 'battleship:game';
const SAVE_VERSION = 1;
const STATS_KEY = 'battleship:stats';

initPage('battleship');
const $ = (id) => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = loadSettings('battleship', { level: 'medium' });
if (!(settings.level in L.LEVELS)) settings.level = 'medium';

const stats = (() => {
  const s = load(STATS_KEY);
  return { wins: Number.isInteger(s?.wins) ? s.wins : 0, losses: Number.isInteger(s?.losses) ? s.losses : 0 };
})();

/* ---------- Trạng thái giao diện (không phải luật, không lưu) ---------- */

const ui = {
  sel: null, // tàu đang cầm: { id, dir, origin: vị trí cũ | null, grabK: ô được nắm (tính từ đầu tàu) }
  orient: 'h', // hướng mặc định cho tàu chọn từ danh sách
  ghost: null, // đầu tàu của vị trí dự kiến { r, c }
  drag: null, // { moved, picked, pressOnGhost }
  hoverEnemy: -1,
  coarse: window.matchMedia('(pointer: coarse)').matches, // thiết bị cảm ứng: chạm hai lần để đặt
  effects: { player: [], bot: [] }, // hiệu ứng theo bàn của bên bị bắn
  resultTimer: null,
};

const match = createMatch(restore() || L.createGame({ level: settings.level, seed: randomSeed() }), {
  persist: (s) => save(SAVE_KEY, s, SAVE_VERSION),
  onChange: handleChange,
  // Máy chờ hiệu ứng của phát trước chạy xong rồi mới bắn.
  botDelay: (ev) => (reduceMotion ? 450 : 750 + (ev?.sunk ? 500 : 0)),
});

function restore() {
  return L.validateGame(load(SAVE_KEY, { version: SAVE_VERSION }));
}

const state = () => match.state;
const fleet = () => match.state.fleets.player;
const shipName = (id) => L.SHIP_BY_ID[id].name;
const lower = (id) => shipName(id).toLowerCase();

/* ---------- Bàn chơi ---------- */

function sizeLimit() {
  // Hai bàn cạnh nhau: vừa chiều cao màn hình. Xếp dọc (điện thoại): chỉ theo chiều ngang.
  const stacked = $('boards').clientWidth < 600;
  const header = document.querySelector('.site-header')?.offsetHeight || 0;
  return stacked ? 520 : Math.max(300, Math.min(520, window.innerHeight - header - 170));
}

const ownBoard = createSeaBoard($('own-board'), {
  sizeLimit,
  draw: (p, geo, colors, now) => drawSea(p, geo, colors, ownView(now), now),
  onPointer: onOwnPointer,
});
const enemyBoard = createSeaBoard($('enemy-board'), {
  sizeLimit,
  draw: (p, geo, colors, now) => drawSea(p, geo, colors, enemyView(now), now),
  onPointer: onEnemyPointer,
});

const footprint = (p) => L.shipFootprint(p);
const dirOf = (cells) => (cells.length > 1 && L.rowOf(cells[0]) === L.rowOf(cells[1]) ? 'h' : 'v');
const toRC = (cells) => cells.map((c) => ({ r: L.rowOf(c), c: L.colOf(c) }));

function marksFrom(grid) {
  return grid.map((g) => (g === 'unknown' ? null : g));
}

function lastShot(by) {
  const h = state().history;
  for (let i = h.length - 1; i >= 0; i--) if (h[i].by === by) return h[i].cell;
  return -1;
}

function liveEffects(list, now) {
  return list.filter((fx) => now < fx.t0 + effectDuration(fx.kind));
}

function heldPlacement() {
  return ui.sel && ui.ghost ? { id: ui.sel.id, r: ui.ghost.r, c: ui.ghost.c, dir: ui.sel.dir } : null;
}

function ownView(now) {
  const s = state();
  const obs = L.observe(s, 'player');
  const damage = L.fleetDamage(s, 'player');
  const ships = fleet().map((p) => {
    const sunk = damage.find((d) => d.id === p.id).sunk;
    const held = s.phase === 'setup' && ui.sel?.id === p.id && ui.ghost;
    return { cells: footprint(p), dir: p.dir, style: sunk ? 'sunk' : held ? 'held' : 'own' };
  });
  const hp = s.phase === 'setup' ? heldPlacement() : null;
  if (hp) ships.push({ cells: footprint(hp), dir: hp.dir, style: L.placementError(fleet(), hp) ? 'ghost-bad' : 'ghost-ok' });
  ui.effects.player = liveEffects(ui.effects.player, now);
  return {
    marks: marksFrom(obs.grid),
    ships,
    hover: -1,
    aim: false,
    last: lastShot('bot'),
    effects: ui.effects.player,
    veil: null,
    dim: false,
  };
}

function enemyView(now) {
  const s = state();
  const obs = L.observe(s, 'bot');
  const ships = obs.sunk.map((x) => ({ cells: toRC(x.cells), dir: dirOf(x.cells), style: 'sunk' }));
  if (L.isOver(s)) {
    // Ván đã kết thúc: hiện toàn bộ bố trí của máy (tàu chưa chìm có viền đứt).
    for (const p of s.fleets.bot) if (!obs.sunk.some((x) => x.id === p.id)) ships.push({ cells: footprint(p), dir: p.dir, style: 'reveal' });
  }
  ui.effects.bot = liveEffects(ui.effects.bot, now);
  const aim = s.phase === 'player';
  return {
    marks: marksFrom(obs.grid),
    ships,
    hover: aim ? ui.hoverEnemy : -1,
    aim,
    last: lastShot('player'),
    effects: ui.effects.bot,
    veil: s.phase === 'setup' ? { title: 'Đối phương đã bố trí xong', sub: 'Đặt đủ năm tàu của bạn rồi bấm “Bắt đầu”.' } : null,
    dim: s.phase === 'bot',
  };
}

/* ---------- Đặt tàu ---------- */

const anchorFor = (r, c, k, dir) => (dir === 'h' ? { r, c: c - k } : { r: r - k, c });

function ghostIndex(r, c) {
  const hp = heldPlacement();
  if (!hp) return -1;
  return footprint(hp).findIndex((q) => q.r === r && q.c === c);
}

function shipAt(cell) {
  return fleet().find((p) => L.shipCells(p).includes(cell)) || null;
}

/** Nhấc một tàu đã đặt lên để di chuyển hoặc xoay; tàu vẫn nằm ở chỗ cũ cho tới khi được đặt lại. */
function pickUp(id, grabK = 0) {
  const p = fleet().find((x) => x.id === id);
  if (!p) return;
  ui.sel = { id, dir: p.dir, origin: p, grabK };
  ui.ghost = { r: p.r, c: p.c };
}

function selectShip(id) {
  if (state().phase !== 'setup') return;
  if (ui.sel?.id === id) { cancelSel(); return; }
  if (fleet().some((p) => p.id === id)) pickUp(id);
  else {
    ui.sel = { id, dir: ui.orient, origin: null, grabK: 0 };
    ui.ghost = null;
  }
  render();
}

function cancelSel() {
  ui.sel = null;
  ui.ghost = null;
  ui.drag = null;
  render();
}

function selectNextUnplaced() {
  const next = L.SHIPS.find((s) => !fleet().some((p) => p.id === s.id));
  ui.sel = next ? { id: next.id, dir: ui.orient, origin: null, grabK: 0 } : null;
  ui.ghost = null;
}

const PLACE_ERRORS = { out: 'Tàu vượt ra ngoài bàn', overlap: 'Tàu chồng lên tàu khác', unknown: 'Tàu không hợp lệ' };

function tryPlace() {
  const hp = heldPlacement();
  if (!hp) return false;
  const err = L.placementError(fleet(), hp);
  if (err) {
    toast(`${PLACE_ERRORS[err]} — chọn vị trí khác`, { tone: 'bad' });
    return false;
  }
  const next = L.setPlayerFleet(state(), L.withShip(fleet(), hp));
  if (!next) return false;
  ui.orient = hp.dir;
  match.update(next);
  selectNextUnplaced();
  render();
  return true;
}

function rotate() {
  if (state().phase !== 'setup') return;
  if (ui.sel) {
    const old = ui.sel.dir;
    ui.sel.dir = old === 'h' ? 'v' : 'h';
    if (ui.ghost) {
      // Xoay quanh ô đang nắm để tàu không nhảy đi xa.
      const k = ui.sel.grabK;
      const r = ui.ghost.r + (old === 'v' ? k : 0);
      const c = ui.ghost.c + (old === 'h' ? k : 0);
      ui.ghost = anchorFor(r, c, k, ui.sel.dir);
    }
    ui.orient = ui.sel.dir;
  } else {
    ui.orient = ui.orient === 'h' ? 'v' : 'h';
  }
  render();
}

function onOwnPointer(e) {
  if (state().phase !== 'setup') return;
  if (e.pointerType !== 'mouse') ui.coarse = true;
  else if (e.type === 'move' && !e.dragging) ui.coarse = false;

  if (e.type === 'leave') {
    if (ui.sel && !ui.drag) ui.ghost = ui.sel.origin ? { r: ui.sel.origin.r, c: ui.sel.origin.c } : null;
    render();
    return;
  }
  if (e.type === 'cancel') {
    ui.drag = null;
    if (ui.sel?.origin) ui.ghost = { r: ui.sel.origin.r, c: ui.sel.origin.c };
    render();
    return;
  }
  if (e.type === 'move') {
    if (ui.drag) {
      if (!e.moved || !ui.sel) return;
      ui.drag.moved = true;
      ui.ghost = anchorFor(e.r, e.c, ui.sel.grabK, ui.sel.dir);
      ownBoard.redraw();
    } else if (e.pointerType === 'mouse' && ui.sel && e.inside) {
      ui.ghost = anchorFor(e.r, e.c, ui.sel.grabK, ui.sel.dir);
      ownBoard.redraw();
    }
    return;
  }
  if (e.type === 'down') {
    if (!e.inside) return;
    const k = ghostIndex(e.r, e.c);
    const occupant = shipAt(e.cell);
    if (k >= 0) {
      // Nhấn lên vị trí dự kiến: có thể kéo tiếp hoặc chạm để xác nhận.
      ui.sel.grabK = k;
      ui.drag = { moved: false, picked: false, pressOnGhost: true };
    } else if (occupant) {
      const p = occupant;
      const grab = L.shipCells(p).indexOf(e.cell);
      pickUp(p.id, grab);
      ui.drag = { moved: false, picked: true, pressOnGhost: false };
    } else if (ui.sel) {
      ui.drag = { moved: false, picked: false, pressOnGhost: false };
    }
    render();
    return;
  }
  if (e.type === 'up') {
    const d = ui.drag;
    ui.drag = null;
    if (!d || !ui.sel) return;
    if (d.moved) {
      if (tryPlace()) return;
      // Thả vào chỗ không hợp lệ: tàu đã đặt trở về chỗ cũ.
      if (ui.sel.origin) ui.ghost = { r: ui.sel.origin.r, c: ui.sel.origin.c };
      render();
      return;
    }
    if (!e.inside || d.picked) { render(); return; }
    if (e.pointerType === 'mouse' || d.pressOnGhost) {
      tryPlace();
    } else {
      // Cảm ứng: chạm lần đầu chỉ hiện vị trí dự kiến (đầu tàu tại ô được chạm).
      ui.sel.grabK = 0;
      ui.ghost = { r: e.r, c: e.c };
      render();
    }
  }
}

function randomize() {
  if (state().phase !== 'setup') return;
  const next = L.setPlayerFleet(state(), L.randomFleet(createRng(randomSeed())));
  ui.sel = null;
  ui.ghost = null;
  match.update(next);
  render();
}

function clearFleet() {
  if (state().phase !== 'setup' || !fleet().length) return;
  match.update(L.setPlayerFleet(state(), []));
  selectNextUnplaced();
  render();
}

function start() {
  const next = L.startBattle(state());
  if (!next) return;
  ui.sel = null;
  ui.ghost = null;
  match.update(next);
  // Trên điện thoại: cuộn tới vùng biển đối phương để bắn.
  if ($('boards').clientWidth < 600) $('enemy-wrap').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- Bắn ---------- */

function onEnemyPointer(e) {
  const s = state();
  if (e.type === 'move' || e.type === 'leave' || e.type === 'cancel') {
    const h = e.type === 'move' && e.inside && e.pointerType === 'mouse' ? e.cell : -1;
    if (h !== ui.hoverEnemy) { ui.hoverEnemy = h; enemyBoard.redraw(); }
    return;
  }
  if (e.type === 'down' && e.pointerType !== 'mouse' && e.inside && s.phase === 'player') {
    ui.hoverEnemy = e.cell; // cảm ứng: hiện tâm ngắm khi đặt ngón tay
    enemyBoard.redraw();
    return;
  }
  if (e.type !== 'up') return;
  if (e.pointerType !== 'mouse') { ui.hoverEnemy = -1; enemyBoard.redraw(); }
  if (!e.tap || !e.inside) return;
  fireAt(e.cell);
}

function fireAt(cell) {
  const s = state();
  if (s.phase === 'setup') { toast('Hãy đặt đủ năm tàu và bấm “Bắt đầu” trước'); return; }
  if (s.phase === 'bot') return; // đang khóa trong lượt máy
  if (L.isOver(s)) { toast('Ván đã kết thúc — bấm “Chơi mới” để chơi tiếp'); return; }
  if (L.observe(s, 'bot').grid[cell] !== 'unknown') { toast(`Ô ${L.coordName(cell)} đã bắn rồi`); return; }
  match.playerFire(cell);
}

/** Gọi sau mỗi thay đổi của ván (match.commit). */
function handleChange(s, events) {
  const now = performance.now();
  for (const ev of events) {
    const target = ev.by === 'player' ? 'bot' : 'player';
    const board = target === 'bot' ? enemyBoard : ownBoard;
    const rc = { r: L.rowOf(ev.cell), c: L.colOf(ev.cell) };
    if (!reduceMotion) {
      ui.effects[target].push({ kind: ev.hit ? 'hit' : 'miss', cells: [rc], t0: now });
      if (ev.sunk) {
        const p = s.fleets[target].find((x) => x.id === ev.sunk);
        ui.effects[target].push({ kind: 'sunk', cells: footprint(p), t0: now + 250 });
      }
      board.animate(effectDuration(ev.sunk ? 'sunk' : 'hit') + 300);
    }
    if (ev.sunk) toast(ev.by === 'player' ? `Bạn đã đánh chìm ${lower(ev.sunk)}!` : `Đối phương đã đánh chìm ${lower(ev.sunk)} của bạn`, { tone: ev.by === 'player' ? 'ok' : 'bad' });
    if (ev.over) finish(s);
  }
  render();
}

function finish(s) {
  const won = s.phase === 'won';
  if (won) stats.wins++;
  else stats.losses++;
  save(STATS_KEY, stats);
  const seed = s.seed;
  const historyLength = s.history.length;
  clearTimeout(ui.resultTimer);
  ui.resultTimer = setTimeout(() => {
    // Bỏ qua nếu người chơi đã bắt đầu ván khác.
    if (state().seed !== seed || state().history.length !== historyLength) return;
    const { shots, hits } = accuracy(state());
    const pct = shots ? Math.round((hits / shots) * 100) : 0;
    resultDialog(
      won ? 'Bạn thắng!' : 'Bạn thua',
      won
        ? `Bạn đã đánh chìm toàn bộ hạm đội đối phương sau ${shots} phát (trúng ${pct}%).`
        : `Máy đã đánh chìm cả năm tàu của bạn. Bạn còn thiếu ${L.shipsAfloat(state(), 'bot')} tàu nữa. Các tàu của máy giờ được hiện trên bàn.`,
      won ? 'win' : 'lose',
      { againLabel: 'Chơi mới', viewLabel: 'Xem bàn' },
    ).then((v) => { if (v === 'again') newGame(true); });
  }, reduceMotion ? 300 : 1300);
}

function accuracy(s) {
  const mine = s.history.filter((h) => h.by === 'player');
  return { shots: mine.length, hits: mine.filter((h) => h.hit).length };
}

async function newGame(skipConfirm = false) {
  const s = state();
  const inProgress = s.phase === 'player' || s.phase === 'bot' || (s.phase === 'setup' && fleet().length > 0);
  if (!skipConfirm && inProgress && !(await confirmDialog(
    'Bắt đầu ván mới?',
    s.phase === 'setup' ? 'Bố trí hạm đội hiện tại sẽ bị xóa.' : 'Ván đang chơi sẽ bị bỏ và không được tính thắng/thua.',
    { confirmLabel: 'Chơi mới', danger: true },
  ))) return;
  clearTimeout(ui.resultTimer);
  ui.effects = { player: [], bot: [] };
  ui.hoverEnemy = -1;
  ui.sel = null;
  ui.ghost = null;
  // replace() hủy lượt máy đang chờ của ván cũ.
  match.replace(L.createGame({ level: settings.level, seed: randomSeed() }));
  selectNextUnplaced();
  render();
  $('own-wrap').scrollIntoView({ behavior: 'auto', block: 'nearest' });
}

function setLevel(level) {
  if (!(level in L.LEVELS) || state().phase !== 'setup') return;
  settings.level = level;
  saveSettings('battleship', settings);
  match.update({ ...state(), level });
}

/* ---------- Hiển thị HTML ---------- */

function logEntries(s) {
  const out = [];
  s.history.forEach((h, i) => {
    const who = h.by === 'player' ? 'Bạn' : 'Đối phương';
    out.push({ text: `${who} bắn ${L.coordName(h.cell)}: ${h.hit ? 'Trúng' : 'Trượt'}.`, cls: `${h.by} ${h.hit ? 'hit' : 'miss'}`, no: i + 1 });
    if (h.sunk) {
      out.push({
        text: h.by === 'player' ? `Bạn đã đánh chìm ${lower(h.sunk)}.` : `Đối phương đã đánh chìm ${lower(h.sunk)} của bạn.`,
        cls: `${h.by} sunk`,
      });
    }
  });
  return out;
}

function callout(s) {
  const last = s.history[s.history.length - 1];
  if (s.phase === 'setup') return { text: 'Bố trí hạm đội của bạn, rồi bấm “Bắt đầu”.', cls: '' };
  if (!last) return { text: 'Trận đánh bắt đầu — bạn bắn trước.', cls: '' };
  const entries = logEntries({ history: [last] });
  return { text: entries.map((x) => x.text).join(' '), cls: last.sunk ? 'sunk' : last.hit ? 'hit' : 'miss' };
}

const TURN = {
  setup: (s) => ['Đặt tàu', `Đã đặt ${s.fleets.player.length}/5 tàu`],
  player: () => ['Lượt của bạn', 'Chọn một ô ở vùng biển đối phương'],
  bot: () => ['Đối phương đang ngắm', 'Bàn bị khóa cho tới khi máy bắn xong'],
  won: (s) => ['Bạn thắng!', `Sau ${accuracy(s).shots} phát · ván đã kết thúc`],
  lost: () => ['Bạn thua', 'Ván đã kết thúc · bàn đối phương đã được hiện ra'],
};

function render() {
  const s = state();
  const setup = s.phase === 'setup';
  ownBoard.redraw();
  enemyBoard.redraw();

  // Lượt hiện tại.
  const [title, sub] = TURN[s.phase](s);
  const turn = $('turn');
  turn.className = `turn ${L.isOver(s) ? 'over' : ''} ${s.phase === 'lost' ? 'alert' : ''}`;
  turn.querySelector('.bs-turn-icon').className = `bs-turn-icon ${s.phase}`;
  const t = turn.querySelector('.turn-title');
  if (s.phase === 'bot') t.innerHTML = 'Đối phương đang ngắm<span class="thinking"><i></i><i></i><i></i></span>';
  else t.textContent = title;
  turn.querySelector('.turn-sub').textContent = sub;

  const c = callout(s);
  $('callout').textContent = c.text;
  $('callout').className = `bs-callout ${c.cls}`;

  // Số tàu còn lại mỗi bên.
  $('own-count').textContent = setup ? `${fleet().length}/5 đã đặt` : `${L.shipsAfloat(s, 'player')}/5 tàu còn nổi`;
  $('enemy-count').textContent = setup ? '5 tàu · đang ẩn' : `${L.shipsAfloat(s, 'bot')}/5 tàu còn nổi`;
  $('own-count').className = `chip ${!setup && L.shipsAfloat(s, 'player') <= 1 ? 'bad' : ''}`;
  $('enemy-count').className = `chip ${!setup && L.shipsAfloat(s, 'bot') <= 1 ? 'ok' : ''}`;

  // Giai đoạn đặt tàu.
  $('setup').hidden = !setup;
  $('own-board').classList.toggle('placing', setup);
  $('boards').classList.toggle('battle', !setup);
  if (setup) renderSetup();

  // Độ khó.
  document.querySelectorAll('#level button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.value === s.level));
    b.disabled = !setup;
  });
  $('level-note').textContent = setup
    ? `Mức ${L.LEVELS[s.level]} áp dụng cho ván này.`
    : `Ván này: mức ${L.LEVELS[s.level]}. Đổi độ khó ở ván mới.`;

  // Thống kê.
  const acc = accuracy(s);
  $('stat-wl').textContent = `${stats.wins} / ${stats.losses}`;
  $('stat-shots').textContent = acc.shots;
  $('stat-acc').textContent = acc.shots ? `${Math.round((acc.hits / acc.shots) * 100)}%` : '—';

  // Hạm đội đối phương: chỉ biết tàu nào đã chìm.
  const sunk = L.sunkShips(s, 'bot');
  $('enemy-fleet').replaceChildren(...L.SHIPS.map((ship) => {
    const down = sunk.includes(ship.id);
    return el('li', { class: down ? 'sunk' : '' },
      el('span', { class: 'bs-pegs', 'aria-hidden': 'true' }, Array.from({ length: ship.size }, () => el('i'))),
      el('span', { class: 'name' }, ship.name),
      el('span', { class: 'state' }, down ? 'Đã chìm' : 'Còn nổi'));
  }));

  // Nhật ký: mới nhất ở trên.
  const entries = logEntries(s).reverse();
  $('log').replaceChildren(...(entries.length
    ? entries.map((x) => el('li', { class: x.cls }, x.no ? el('span', { class: 'no' }, `${x.no}.`) : el('span', { class: 'no' }), x.text))
    : [el('li', { class: 'history-empty' }, setup ? 'Chưa có phát bắn nào. Đặt tàu xong để bắt đầu.' : 'Chưa có phát bắn nào.')]));
}

function renderSetup() {
  const placed = new Set(fleet().map((p) => p.id));
  $('ship-list').replaceChildren(...L.SHIPS.map((ship) => el('button', {
    type: 'button',
    class: `bs-ship ${placed.has(ship.id) ? 'placed' : ''}`,
    'data-ship': ship.id,
    'aria-pressed': String(ui.sel?.id === ship.id),
    title: placed.has(ship.id) ? 'Đã đặt — bấm để nhấc lên di chuyển/xoay' : 'Bấm để chọn rồi đặt lên bàn',
  },
  el('span', { class: 'bs-pegs', 'aria-hidden': 'true' }, Array.from({ length: ship.size }, () => el('i'))),
  el('span', { class: 'name' }, ship.name),
  el('span', { class: 'state' }, placed.has(ship.id) ? '✓ Đã đặt' : `${ship.size} ô`))));

  const dir = ui.sel ? ui.sel.dir : ui.orient;
  $('btn-rotate').textContent = `Xoay: ${dir === 'h' ? 'Ngang ↔' : 'Dọc ↕'}`;
  $('btn-clear').disabled = !fleet().length;
  $('btn-start').disabled = !L.canStart(state());

  let help;
  if (ui.sel) {
    const ship = L.SHIP_BY_ID[ui.sel.id];
    const how = ui.coarse
      ? (ui.ghost ? 'Chạm vào vị trí dự kiến để đặt, hoặc chạm ô khác để dời.' : 'Chạm vào ô làm đầu tàu.')
      : 'Nhấp vào ô làm đầu tàu (hoặc kéo tàu đã đặt).';
    help = `${ui.sel.origin ? 'Đang dời' : 'Đang đặt'} ${ship.name.toLowerCase()} (${ship.size} ô, ${ui.sel.dir === 'h' ? 'ngang' : 'dọc'}). ${how}`;
  } else if (L.canStart(state())) {
    help = 'Đã đặt đủ năm tàu. Bấm “Bắt đầu”, hoặc chạm vào một tàu để chỉnh lại.';
  } else {
    help = 'Chọn một tàu trong danh sách để đặt lên bàn.';
  }
  $('setup-help').textContent = help;
}

/* ---------- Sự kiện ---------- */

bindActions(document.querySelector('.game-layout'), {
  rotate,
  random: randomize,
  clear: clearFleet,
  start,
  'new-game': () => newGame(false),
});

$('ship-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ship]');
  if (btn) selectShip(btn.dataset.ship);
});

$('level').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-value]');
  if (btn && !btn.disabled) setLevel(btn.dataset.value);
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'r' && state().phase === 'setup') { e.preventDefault(); rotate(); }
  else if (k === 'escape' && ui.sel) cancelSel();
});

window.addEventListener('pagehide', () => save(SAVE_KEY, state(), SAVE_VERSION));

if (state().phase === 'setup') selectNextUnplaced();
render();
// Tải lại trang giữa lượt máy: tiếp tục đúng một lượt (trạng thái đã lưu là "lượt máy, chưa bắn").
match.resume();
