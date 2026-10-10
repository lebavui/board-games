// Điều khiển trang Sudoku: trạng thái ván, nhập liệu, lưu trữ và giao diện HTML.
import { initPage, readThemeColors, confirmDialog, resultDialog, toast, formatTime, bindActions } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { Stopwatch } from '../../common/stopwatch.js';
import {
  DIFFICULTIES, generatePuzzle, countSolutions, findConflicts, isComplete, candidatesFor, PEERS,
} from './logic.js';
import { drawSudoku, layout, hitTest, COLOR_NAMES } from './view.js';

const SAVE_KEY = 'sudoku:game';
const SAVE_VERSION = 1;
const LEVEL_TEXT = { 1: 'chỉ cần ô/vị trí duy nhất', 2: 'cần khóa ứng viên, cặp/bộ ba', 3: 'cần kỹ thuật nâng cao' };

initPage('sudoku');

const settings = loadSettings('sudoku', { difficulty: 'easy', autoClearNotes: true, highlightSame: true, showConflicts: true });

let game = null;           // trạng thái được lưu
let selected = -1;         // ô đang chọn (không lưu)
let noteMode = false;
let wrong = new Set();     // ô sai sau khi bấm "Kiểm tra"
let colors = readThemeColors(COLOR_NAMES);

const $ = (id) => document.getElementById(id);
const stopwatch = new Stopwatch((s) => { $('timer').textContent = formatTime(s); });

/* ---------------- Trạng thái ---------------- */

function newGame(difficulty) {
  const g = generatePuzzle(difficulty);
  // Kiểm tra lại tính duy nhất trước khi giao đề cho người chơi.
  if (countSolutions(g.puzzle, 2).count !== 1) throw new Error('Đề không có lời giải duy nhất');
  game = {
    difficulty,
    puzzle: g.puzzle,
    solution: g.solution,
    values: g.puzzle.slice(),
    notes: new Array(81).fill(0),
    hinted: [],
    level: g.level,
    clues: g.clues,
    hints: 0,
    elapsed: 0,
    status: 'playing',
    undo: [],
  };
  selected = -1;
  wrong = new Set();
  stopwatch.reset(0);
  stopwatch.start();
  persist();
  refresh();
}

function restoreGame() {
  const data = load(SAVE_KEY, { version: SAVE_VERSION });
  if (!data || !Array.isArray(data.puzzle) || data.puzzle.length !== 81) return false;
  game = data;
  stopwatch.reset(game.elapsed || 0);
  if (game.status === 'playing') stopwatch.start();
  return true;
}

function persist() {
  if (!game) return;
  game.elapsed = stopwatch.seconds;
  game.undo = game.undo.slice(-300);
  save(SAVE_KEY, game, SAVE_VERSION);
}

const hasProgress = () => game && game.status === 'playing' && game.values.some((v, i) => v && !game.puzzle[i]);
const isLocked = () => !game || game.status !== 'playing';

/** Ghi một thay đổi (có thể gồm nhiều ô) vào ngăn hoàn tác. */
function applyChanges(changes) {
  const record = changes.map(({ i }) => ({ i, v: game.values[i], n: game.notes[i] }));
  let changed = false;
  for (const { i, v, n } of changes) {
    if (game.values[i] !== v || game.notes[i] !== n) changed = true;
    game.values[i] = v;
    game.notes[i] = n;
    wrong.delete(i);
  }
  if (!changed) return false;
  game.undo.push(record);
  return true;
}

function enterDigit(d) {
  if (isLocked() || selected < 0 || game.puzzle[selected]) return;
  const i = selected;
  if (noteMode) {
    if (game.values[i]) return;
    applyChanges([{ i, v: 0, n: game.notes[i] ^ (1 << d) }]);
  } else {
    const v = game.values[i] === d ? 0 : d;
    const changes = [{ i, v, n: 0 }];
    if (v && settings.autoClearNotes) {
      for (const p of PEERS[i]) if (game.notes[p] & (1 << d)) changes.push({ i: p, v: game.values[p], n: game.notes[p] & ~(1 << d) });
    }
    applyChanges(changes);
    game.hinted = game.hinted.filter((h) => h !== i);
  }
  afterMove();
}

function erase() {
  if (isLocked() || selected < 0 || game.puzzle[selected]) return;
  if (applyChanges([{ i: selected, v: 0, n: 0 }])) {
    game.hinted = game.hinted.filter((h) => h !== selected);
    afterMove();
  }
}

function undo() {
  if (isLocked()) return;
  const record = game.undo.pop();
  if (!record) { toast('Không còn bước nào để hoàn tác'); return; }
  for (const { i, v, n } of record) { game.values[i] = v; game.notes[i] = n; wrong.delete(i); }
  selected = record[0].i;
  afterMove(false);
}

function hint() {
  if (isLocked()) return;
  let target = -1;
  if (selected >= 0 && !game.puzzle[selected] && game.values[selected] !== game.solution[selected]) target = selected;
  if (target < 0) {
    // Ưu tiên ô sai, sau đó ô trống có ít ứng viên nhất.
    const wrongCell = game.values.findIndex((v, i) => v && v !== game.solution[i]);
    if (wrongCell >= 0) target = wrongCell;
    else {
      let best = 10;
      for (let i = 0; i < 81; i++) {
        if (game.values[i]) continue;
        const mask = candidatesFor(game.values, i);
        let n = 0; for (let d = 1; d <= 9; d++) if (mask & (1 << d)) n++;
        if (n < best) { best = n; target = i; }
      }
    }
  }
  if (target < 0) return;
  const d = game.solution[target];
  const changes = [{ i: target, v: d, n: 0 }];
  if (settings.autoClearNotes) {
    for (const p of PEERS[target]) if (game.notes[p] & (1 << d)) changes.push({ i: p, v: game.values[p], n: game.notes[p] & ~(1 << d) });
  }
  applyChanges(changes);
  game.hinted.push(target);
  game.hints++;
  selected = target;
  toast(`Gợi ý: ô hàng ${Math.floor(target / 9) + 1}, cột ${(target % 9) + 1} là ${d}`);
  afterMove();
}

function check() {
  if (isLocked()) return;
  wrong = new Set();
  game.values.forEach((v, i) => { if (v && !game.puzzle[i] && v !== game.solution[i]) wrong.add(i); });
  const empty = game.values.filter((v) => !v).length;
  if (wrong.size) toast(`Có ${wrong.size} ô sai (đánh dấu màu đỏ)`, { tone: 'bad' });
  else toast(empty ? `Chưa có ô sai · còn ${empty} ô trống` : 'Không có ô sai', { tone: 'ok' });
  refresh();
}

function afterMove(checkWin = true) {
  if (checkWin && isComplete(game.values)) {
    game.status = 'won';
    stopwatch.stop();
    selected = -1;
    persist();
    refresh();
    const msg = `Thời gian: ${formatTime(game.elapsed)} · Mức: ${DIFFICULTIES[game.difficulty].label}` +
      (game.hints ? ` · Dùng ${game.hints} gợi ý` : '');
    resultDialog('Hoàn thành!', msg, 'win').then((v) => { if (v === 'again') newGame(game.difficulty); });
    return;
  }
  persist();
  refresh();
}

/* ---------------- Giao diện ---------------- */

function refresh() {
  if (!game) return;
  board.redraw();
  const locked = isLocked();
  const counts = new Array(10).fill(0);
  game.values.forEach((v) => { if (v) counts[v]++; });
  document.querySelectorAll('#numpad [data-digit]').forEach((btn) => {
    const d = Number(btn.dataset.digit);
    btn.querySelector('.count').textContent = counts[d] >= 9 ? '✓' : String(9 - counts[d]);
    btn.disabled = locked;
  });
  document.querySelectorAll('.tools .btn, #numpad [data-action]').forEach((b) => { b.disabled = locked; });
  $('btn-notes').classList.toggle('is-on', noteMode);
  $('btn-notes').setAttribute('aria-pressed', String(noteMode));
  $('btn-undo').disabled = locked || game.undo.length === 0;
  $('btn-restart').disabled = locked && game.status !== 'won';

  document.querySelectorAll('#difficulty button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === game.difficulty)));
  const filled = game.values.filter((v) => v).length;
  $('chip-progress').innerHTML = `<span class="label">Đã điền</span> ${filled}/81`;
  $('chip-level').innerHTML = `<span class="label">Mức</span> ${DIFFICULTIES[game.difficulty].label}`;
  const stateChip = $('chip-state');
  if (game.status === 'won') { stateChip.className = 'chip ok'; stateChip.textContent = 'Đã hoàn thành'; }
  else if (noteMode) { stateChip.className = 'chip warn'; stateChip.textContent = 'Chế độ ghi chú'; }
  else { stateChip.className = 'chip'; stateChip.innerHTML = '<span class="label">Nhập</span> Số'; }
  $('puzzle-info').textContent = `Đề có ${game.clues} số gợi ý, độ khó đo được: ${LEVEL_TEXT[game.level] || ''}. Đã dùng ${game.hints} gợi ý.`;
  for (const key of ['autoClearNotes', 'highlightSame', 'showConflicts']) $(`opt-${key}`).checked = settings[key];
}

const board = createBoard($('board'), {
  reserveHeight: 56,
  layout,
  draw: (p, w, h) => {
    if (!game) return;
    drawSudoku(p, w, h, {
      puzzle: game.puzzle,
      values: game.values,
      notes: game.notes,
      selected: isLocked() ? -1 : selected,
      wrong,
      hinted: new Set(game.hinted),
      conflicts: settings.showConflicts ? findConflicts(game.values) : new Set(),
      won: game.status === 'won',
      highlightSame: settings.highlightSame,
    }, colors);
  },
  onPress: ({ x, y }) => {
    if (isLocked()) return;
    const i = hitTest(x, y, board.size.width);
    if (i < 0) return;
    selected = i;
    refresh();
  },
});

window.addEventListener('themechange', () => { colors = readThemeColors(COLOR_NAMES); board.redraw(); });

async function requestNewGame(difficulty) {
  if (hasProgress() && !(await confirmDialog('Bắt đầu ván mới?', 'Tiến trình của ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
  settings.difficulty = difficulty;
  saveSettings('sudoku', settings);
  newGame(difficulty);
}

async function restart() {
  if (!game) return;
  if (hasProgress() && !(await confirmDialog('Chơi lại từ đầu?', 'Mọi số đã điền và ghi chú sẽ bị xóa, đề bài giữ nguyên.', { confirmLabel: 'Chơi lại', danger: true }))) return;
  Object.assign(game, { values: game.puzzle.slice(), notes: new Array(81).fill(0), hinted: [], hints: 0, undo: [], status: 'playing' });
  wrong = new Set();
  selected = -1;
  stopwatch.reset(0);
  stopwatch.start();
  persist();
  refresh();
}

bindActions(document.querySelector('.game-layout'), {
  digit: (btn) => enterDigit(Number(btn.dataset.digit)),
  erase,
  undo,
  hint,
  check,
  notes: () => { noteMode = !noteMode; refresh(); },
  'new-game': () => requestNewGame(settings.difficulty),
  restart,
  difficulty: (btn) => requestNewGame(btn.dataset.value),
});

for (const key of ['autoClearNotes', 'highlightSame', 'showConflicts']) {
  $(`opt-${key}`).addEventListener('change', (e) => {
    settings[key] = e.target.checked;
    saveSettings('sudoku', settings);
    refresh();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog') || isLocked()) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code);
  if (digit) {
    e.preventDefault();
    if (e.shiftKey && !noteMode) { noteMode = true; enterDigit(Number(digit[2])); noteMode = false; refresh(); }
    else enterDigit(Number(digit[2]));
    return;
  }
  const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
  if (e.key in moves) {
    e.preventDefault();
    if (selected < 0) selected = 40;
    else {
      const r = Math.floor(selected / 9), c = selected % 9;
      const nr = (r + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0) + 9) % 9;
      const nc = (c + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0) + 9) % 9;
      selected = nr * 9 + nc;
    }
    refresh();
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); erase(); }
  else if (e.key.toLowerCase() === 'n') { noteMode = !noteMode; refresh(); }
  else if (e.key === 'Escape') { selected = -1; refresh(); }
});

window.addEventListener('pagehide', persist);

if (!restoreGame()) newGame(settings.difficulty);
refresh();
