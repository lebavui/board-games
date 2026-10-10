// Điều khiển trang Dò mìn.
import { initPage, readThemeColors, confirmDialog, resultDialog, formatTime, bindActions, isDarkTheme, toast } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { Stopwatch } from '../../common/stopwatch.js';
import { LEVELS, createGame, reveal, chord, toggleFlag, minesLeft } from './logic.js';
import { drawMinesweeper, layout, hitTest, COLOR_NAMES } from './view.js';

const SAVE_KEY = 'minesweeper:game';
const SAVE_VERSION = 1;
const BEST_KEY = 'minesweeper:best';

initPage('minesweeper');

const settings = loadSettings('minesweeper', { level: 'easy', mode: 'open' });
const $ = (id) => document.getElementById(id);

let game = null;
let geo = { cell: 20, transposed: false };
let colors = readThemeColors(COLOR_NAMES);
let best = load(BEST_KEY) || {};
const stopwatch = new Stopwatch((s) => { $('timer').textContent = formatTime(s); });

function newGame(level) {
  game = createGame(level);
  game.elapsed = 0;
  stopwatch.reset(0);
  persist();
  board.relayout();
  refresh();
}

function restore() {
  const data = load(SAVE_KEY, { version: SAVE_VERSION });
  if (!data || !LEVELS[data.level] || !Array.isArray(data.revealed)) return false;
  game = data;
  stopwatch.reset(game.elapsed || 0);
  if (game.status === 'playing') stopwatch.start();
  return true;
}

function persist() {
  if (!game) return;
  game.elapsed = stopwatch.seconds;
  save(SAVE_KEY, game, SAVE_VERSION);
}

const isOver = () => game.status === 'won' || game.status === 'lost';
const hasProgress = () => game && game.status === 'playing';

function act(i, action) {
  if (isOver() || i < 0) return;
  let changed = false;
  if (action === 'flag') changed = toggleFlag(game, i);
  else if (game.revealed[i]) changed = chord(game, i);
  else changed = reveal(game, i);
  if (!changed) return;
  if (game.status === 'playing' && !stopwatch.running) stopwatch.start();
  if (isOver()) finish();
  persist();
  refresh();
}

function finish() {
  stopwatch.stop();
  game.elapsed = stopwatch.seconds;
  const levelLabel = LEVELS[game.level].label;
  if (game.status === 'won') {
    let record = '';
    if (!best[game.level] || game.elapsed < best[game.level]) {
      best[game.level] = game.elapsed;
      save(BEST_KEY, best);
      record = '\nKỷ lục mới!';
    }
    resultDialog('Bạn đã thắng!', `Mức ${levelLabel} · Thời gian ${formatTime(game.elapsed)}${record}`, 'win')
      .then((v) => { if (v === 'again') newGame(game.level); });
  } else {
    resultDialog('Trúng mìn!', `Bạn đã mở trúng mìn sau ${formatTime(game.elapsed)}. Bàn cờ hiển thị vị trí tất cả các mìn.`, 'lose', { againLabel: 'Chơi lại' })
      .then((v) => { if (v === 'again') newGame(game.level); });
  }
}

function refresh() {
  board.redraw();
  $('mines-left').textContent = String(minesLeft(game));
  document.querySelectorAll('#level button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === game.level)));
  document.querySelectorAll('#mode button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.value === settings.mode));
    b.disabled = isOver();
  });
  const chip = $('chip-state');
  const states = {
    ready: ['chip', 'Chạm một ô để bắt đầu'],
    playing: ['chip', settings.mode === 'flag' ? 'Đang ở chế độ cắm cờ' : 'Đang chơi'],
    won: ['chip ok', 'Thắng'],
    lost: ['chip bad', 'Thua'],
  };
  [chip.className, chip.textContent] = states[game.status];
  if (game.status === 'playing' && settings.mode === 'flag') chip.className = 'chip warn';
  const lvl = LEVELS[game.level];
  $('level-info').textContent = `${lvl.cols} cột × ${lvl.rows} hàng, ${lvl.mines} mìn.` +
    (best[game.level] ? ` Kỷ lục: ${formatTime(best[game.level])}.` : '') +
    (geo.transposed ? ' Bàn đang được xoay dọc cho vừa màn hình.' : '');
}

const board = createBoard($('board'), {
  reserveHeight: 110,
  longPress: true,
  layout: (w, h) => {
    if (!game) return { width: w, height: w };
    geo = layout(game, w, h);
    return geo;
  },
  draw: (p) => { if (game) drawMinesweeper(p, geo, game, colors, isDarkTheme()); },
  onPress: ({ x, y, button, long }) => {
    if (!game) return;
    const i = hitTest(game, geo, x, y);
    const flag = button === 'right' || long || settings.mode === 'flag';
    act(i, flag ? 'flag' : 'open');
  },
});

window.addEventListener('themechange', () => { colors = readThemeColors(COLOR_NAMES); board.redraw(); });

async function requestNewGame(level) {
  if (hasProgress() && !(await confirmDialog('Bắt đầu ván mới?', 'Ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
  settings.level = level;
  saveSettings('minesweeper', settings);
  newGame(level);
}

/** Chơi lại đúng bàn mìn hiện tại (giữ nguyên vị trí mìn). */
async function replaySameBoard() {
  if (!game.mineAt) { toast('Bàn chưa có mìn — hãy mở ô đầu tiên'); return; }
  if (hasProgress() && !(await confirmDialog('Chơi lại bàn này?', 'Các ô đã mở và cờ đã cắm sẽ bị xóa; vị trí mìn giữ nguyên.', { confirmLabel: 'Chơi lại', danger: true }))) return;
  const n = game.cols * game.rows;
  Object.assign(game, { revealed: new Array(n).fill(0), flagged: new Array(n).fill(0), status: 'playing', exploded: -1, revealedCount: 0 });
  stopwatch.reset(0);
  persist();
  refresh();
}

function setMode(mode) {
  settings.mode = mode;
  saveSettings('minesweeper', settings);
  refresh();
}

bindActions(document.querySelector('.game-layout'), {
  level: (btn) => requestNewGame(btn.dataset.value),
  mode: (btn) => setMode(btn.dataset.value),
  'new-game': () => requestNewGame(game.level),
  restart: replaySameBoard,
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if (e.key.toLowerCase() === 'f' && !isOver()) {
    setMode(settings.mode === 'flag' ? 'open' : 'flag');
    toast(settings.mode === 'flag' ? 'Chế độ cắm cờ' : 'Chế độ mở ô');
  }
});

window.addEventListener('pagehide', persist);

if (!restore()) game = createGame(settings.level);
board.relayout();
refresh();
