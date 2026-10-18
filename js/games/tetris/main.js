// Điều khiển trang Xếp gạch: vòng lặp khung hình, bàn phím (DAS/ARR), nút cảm ứng, lưu ván và bảng điểm cao.
import { initPage, readThemeColors, confirmDialog, resultDialog, formatTime, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { createGame, tick, move, rotate, hardDrop, hold, start, pause, isValidState } from './logic.js';
import { drawTetris, layout, COLOR_NAMES } from './view.js';

const SAVE_KEY = 'tetris:game';
const SAVE_VERSION = 1;
const BEST_KEY = 'tetris:best';
const BEST_COUNT = 5;
const DAS = 170;   // ms giữ phím trước khi tự lặp sang ngang
const ARR = 50;    // ms giữa hai bước tự lặp

initPage('tetris');

const settings = loadSettings('tetris', { startLevel: 1, ghost: true });
const $ = (id) => document.getElementById(id);

let game = null;
let geo = { cell: 20 };
let colors = readThemeColors(COLOR_NAMES);
let best = Array.isArray(load(BEST_KEY)) ? load(BEST_KEY).filter((b) => b && typeof b.score === 'number') : [];
let raf = null;
let lastFrame = null;

// Trạng thái phím đang giữ (bàn phím và nút cảm ứng dùng chung).
const held = { left: false, right: false, down: false };
let shiftDir = 0;
let dasAcc = 0;

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function newGame() {
  game = createGame({ startLevel: settings.startLevel, seed: newSeed() });
  persist();
  refresh();
}

function restore() {
  const data = load(SAVE_KEY, { version: SAVE_VERSION });
  if (!isValidState(data)) return false;
  game = data;
  if (game.status === 'playing') game.status = 'paused'; // tải lại trang: chờ người chơi tiếp tục
  return true;
}

function persist() {
  if (game) save(SAVE_KEY, game, SAVE_VERSION);
}

/* ---------- Vòng lặp ---------- */

function frame(now) {
  raf = null;
  if (game.status !== 'playing') { lastFrame = null; return; }
  const dt = lastFrame == null ? 0 : Math.min(100, now - lastFrame);
  lastFrame = now;
  autoShift(dt);
  if (tick(game, dt, { softDrop: held.down })) afterLock();
  board.redraw();
  updateStats();
  if (game.status === 'playing') raf = requestAnimationFrame(frame);
}

function runLoop() {
  if (raf == null && game.status === 'playing') {
    lastFrame = null;
    raf = requestAnimationFrame(frame);
  }
}

function autoShift(dt) {
  if (!shiftDir) return;
  dasAcc += dt;
  while (dasAcc >= DAS + ARR) {
    dasAcc -= ARR;
    if (!move(game, shiftDir)) { dasAcc = DAS; break; }
  }
}

function afterLock() {
  persist();
  if (game.status === 'over') finish();
}

/* ---------- Điều khiển ---------- */

function resume() {
  if (!start(game)) return;
  refresh();
  runLoop();
}

function pauseGame() {
  if (!pause(game)) return;
  releaseAll();
  persist();
  refresh();
}

function togglePause() {
  if (game.status === 'playing') pauseGame();
  else resume();
}

function releaseAll() {
  held.left = held.right = held.down = false;
  shiftDir = 0;
}

/** Nhấn một nút điều khiển: 'left' | 'right' | 'down' | 'cw' | 'ccw' | 'drop' | 'hold'. */
function press(key) {
  if (game.status !== 'playing') return;
  if (key === 'left' || key === 'right') {
    held[key] = true;
    shiftDir = key === 'left' ? -1 : 1;
    dasAcc = 0;
    move(game, shiftDir);
  } else if (key === 'down') {
    held.down = true;
  } else if (key === 'cw' || key === 'ccw') {
    rotate(game, key === 'cw' ? 1 : -1);
  } else if (key === 'drop') {
    if (hardDrop(game)) afterLock();
  } else if (key === 'hold') {
    if (hold(game)) persist();
    if (game.status === 'over') finish();
  }
  board.redraw();
  updateStats();
}

function release(key) {
  if (!(key in held)) return;
  held[key] = false;
  if (key === 'left' || key === 'right') {
    // Nhả một hướng mà hướng kia vẫn giữ thì chuyển sang hướng kia.
    const other = key === 'left' ? 'right' : 'left';
    shiftDir = held[other] ? (other === 'left' ? -1 : 1) : 0;
    dasAcc = 0;
  }
}

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
  ArrowUp: 'cw', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw',
  ' ': 'drop', c: 'hold', C: 'hold', Shift: 'hold',
};

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog') || document.querySelector('dialog[open]')) return;
  // Enter/Space trên nút đang được chọn bằng bàn phím thì để nút tự xử lý.
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, a')) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (game.status !== 'over') togglePause();
    e.preventDefault();
    return;
  }
  if (e.key === 'Enter') {
    if (game.status === 'ready' || game.status === 'paused') { resume(); e.preventDefault(); }
    return;
  }
  const key = KEYS[e.key];
  if (!key) return;
  if (game.status !== 'playing') return;
  e.preventDefault(); // chặn cuộn trang bằng phím mũi tên/Space
  if (e.repeat) return; // tự lặp do DAS/ARR đảm nhận
  press(key);
});

document.addEventListener('keyup', (e) => {
  const key = KEYS[e.key];
  if (key) release(key);
});

// Nút cảm ứng: giữ nút trái/phải/xuống để lặp như giữ phím.
for (const btn of document.querySelectorAll('[data-key]')) {
  const key = btn.dataset.key;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    press(key);
  });
  const up = () => release(key);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Rời tab hoặc cửa sổ: tự tạm dừng.
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', pauseGame);
window.addEventListener('pagehide', persist);

/* ---------- Kết thúc ván và điểm cao ---------- */

function finish() {
  releaseAll();
  const entry = { score: game.score, lines: game.lines, level: game.level, time: Math.floor(game.elapsedMs / 1000), date: Date.now() };
  let rank = -1;
  if (game.score > 0) {
    best = [...best, entry].sort((a, b) => b.score - a.score).slice(0, BEST_COUNT);
    rank = best.indexOf(entry);
    if (rank >= 0) save(BEST_KEY, best);
  }
  persist();
  refresh();
  const record = rank === 0 ? '\nKỷ lục mới!' : rank > 0 ? `\nXếp hạng ${rank + 1} trong bảng điểm cao.` : '';
  resultDialog('Kết thúc ván',
    `${game.score.toLocaleString('vi-VN')} điểm · ${game.lines} hàng · cấp ${game.level} · ${formatTime(entry.time)}${record}`,
    rank === 0 ? 'win' : 'draw', { viewLabel: 'Xem giếng' })
    .then((v) => { if (v === 'again') newGame(); });
}

/* ---------- Hiển thị ---------- */

let lastStats = '';
function updateStats() {
  const text = `${game.score}|${game.lines}|${game.level}|${Math.floor(game.elapsedMs / 1000)}`;
  if (text === lastStats) return;
  lastStats = text;
  $('score').textContent = game.score.toLocaleString('vi-VN');
  $('lines').textContent = String(game.lines);
  $('level').textContent = String(game.level);
  $('timer').textContent = formatTime(game.elapsedMs / 1000);
}

function refresh() {
  board.redraw();
  lastStats = '';
  updateStats();
  const toggle = $('toggle');
  toggle.textContent = { ready: 'Bắt đầu', playing: 'Tạm dừng', paused: 'Tiếp tục', over: 'Bắt đầu' }[game.status];
  toggle.disabled = game.status === 'over';
  const chip = $('chip-state');
  [chip.className, chip.textContent] = {
    ready: ['chip', 'Sẵn sàng'],
    playing: ['chip ok', 'Đang chơi'],
    paused: ['chip warn', 'Tạm dừng'],
    over: ['chip bad', 'Kết thúc'],
  }[game.status];
  document.querySelectorAll('[data-key]').forEach((b) => { b.disabled = game.status !== 'playing'; });
  $('opt-level').value = String(settings.startLevel);
  $('opt-ghost').checked = settings.ghost;
  $('level-info').textContent = `Ván này bắt đầu từ cấp ${game.startLevel}.`;
  renderBest();
}

function renderBest() {
  const list = $('best-list');
  if (!best.length) {
    list.replaceChildren(el('li', { class: 'muted' }, 'Chưa có điểm nào.'));
    return;
  }
  list.replaceChildren(...best.map((b) => el('li', {},
    el('b', {}, b.score.toLocaleString('vi-VN')), ` điểm · ${b.lines} hàng · cấp ${b.level}`,
    b.date ? el('span', { class: 'muted' }, ` · ${new Date(b.date).toLocaleDateString('vi-VN')}`) : null)));
}

const board = createBoard($('board'), {
  reserveHeight: matchMedia('(pointer: coarse)').matches ? 200 : 70,
  layout: (w, h) => {
    geo = layout(w, h);
    return geo;
  },
  draw: (p) => { if (game) drawTetris(p, geo, game, colors, { showGhost: settings.ghost }); },
  onPress: ({ button }) => {
    if (!game || button === 'right') return;
    if (game.status === 'playing') press('cw');
    else resume();
  },
});

window.addEventListener('themechange', () => { colors = readThemeColors(COLOR_NAMES); board.redraw(); });

async function requestNewGame() {
  const inProgress = game.status === 'playing' || game.status === 'paused';
  if (inProgress) {
    pauseGame();
    if (!(await confirmDialog('Bắt đầu ván mới?', 'Ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
  }
  newGame();
}

bindActions(document.querySelector('.game-layout'), {
  toggle: (btn, e) => {
    if (e.detail) btn.blur(); // bấm chuột: bỏ focus để phím Space không kích hoạt lại nút
    if (game.status === 'over') return;
    togglePause();
  },
  'new-game': (btn, e) => {
    if (e.detail) btn.blur();
    requestNewGame();
  },
});

$('opt-level').addEventListener('change', (e) => {
  settings.startLevel = Number(e.target.value) || 1;
  saveSettings('tetris', settings);
  if (game.status === 'ready' && game.pieces === 0) newGame(); // ván chưa bắt đầu thì áp dụng ngay
  else refresh();
});
$('opt-ghost').addEventListener('change', (e) => {
  settings.ghost = e.target.checked;
  saveSettings('tetris', settings);
  board.redraw();
});

if (!restore()) game = createGame({ startLevel: settings.startLevel, seed: newSeed() });
refresh();
