// Điều khiển trang Kakuro.
import { initPage, readThemeColors, confirmDialog, resultDialog, toast, formatTime, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { Stopwatch } from '../../common/stopwatch.js';
import { parsePuzzle, verifyPuzzle, analyzeEntries, isSolved, combinations } from './logic.js';
import { PUZZLES } from './puzzles.js';
import { drawKakuro, layout, hitTest, COLOR_NAMES } from './view.js';

const SAVE_KEY = 'kakuro:progress';
const SAVE_VERSION = 1;

initPage('kakuro');

const settings = loadSettings('kakuro', { showConflicts: true });
const $ = (id) => document.getElementById(id);

// Chỉ dùng các đề vượt qua bước kiểm chứng (cấu trúc + đúng một lời giải).
const VERIFIED = PUZZLES.filter((def) => {
  const res = verifyPuzzle(def);
  if (!res.ok) console.error(`Bỏ đề Kakuro ${def.id}:`, res.errors);
  return res.ok;
});

let saveData = load(SAVE_KEY, { version: SAVE_VERSION }) || { current: VERIFIED[0].id, games: {}, solved: [] };
let model = null;
let game = null;
let selected = null;
let noteMode = false;
let wrong = new Set();
let colors = readThemeColors(COLOR_NAMES);
const stopwatch = new Stopwatch((s) => { $('timer').textContent = formatTime(s); });

const emptyGrid = () => model.cells.map((row) => row.map(() => 0));

function openPuzzle(id) {
  if (game) persist();
  const def = VERIFIED.find((p) => p.id === id) || VERIFIED[0];
  model = parsePuzzle(def);
  saveData.current = def.id;
  const stored = saveData.games[def.id];
  game = stored && stored.values?.length === model.height
    ? stored
    : { values: emptyGrid(), notes: emptyGrid(), hinted: [], hints: 0, undo: [], elapsed: 0, status: 'playing' };
  selected = null;
  wrong = new Set();
  stopwatch.reset(game.elapsed || 0);
  if (game.status === 'playing') stopwatch.start();
  persist();
  board.relayout();
  refresh();
}

function persist() {
  if (!game || !model) return;
  game.elapsed = stopwatch.seconds;
  game.undo = game.undo.slice(-300);
  saveData.games[model.id] = game;
  save(SAVE_KEY, saveData, SAVE_VERSION);
}

const isLocked = () => !game || game.status !== 'playing';
const hasProgress = () => game && game.values.some((row) => row.some((v) => v));
const isWhite = (r, c) => model.cells[r]?.[c]?.type === 'white';

function applyChanges(changes) {
  const record = changes.map(([r, c]) => [r, c, game.values[r][c], game.notes[r][c]]);
  let changed = false;
  for (const [r, c, v, n] of changes) {
    if (game.values[r][c] !== v || game.notes[r][c] !== n) changed = true;
    game.values[r][c] = v;
    game.notes[r][c] = n;
    wrong.delete(`${r},${c}`);
  }
  if (changed) game.undo.push(record);
  return changed;
}

function runPeers(r, c) {
  const cell = model.cells[r][c];
  return [...model.runs[cell.hRun].cells, ...model.runs[cell.vRun].cells].filter(([a, b]) => a !== r || b !== c);
}

function enterDigit(d) {
  if (isLocked() || !selected) return;
  const [r, c] = selected;
  if (noteMode) {
    if (game.values[r][c]) return;
    applyChanges([[r, c, 0, game.notes[r][c] ^ (1 << d)]]);
  } else {
    const v = game.values[r][c] === d ? 0 : d;
    const changes = [[r, c, v, 0]];
    if (v) for (const [a, b] of runPeers(r, c)) if (game.notes[a][b] & (1 << d)) changes.push([a, b, game.values[a][b], game.notes[a][b] & ~(1 << d)]);
    applyChanges(changes);
    game.hinted = game.hinted.filter((k) => k !== `${r},${c}`);
  }
  afterMove();
}

function erase() {
  if (isLocked() || !selected) return;
  const [r, c] = selected;
  if (applyChanges([[r, c, 0, 0]])) {
    game.hinted = game.hinted.filter((k) => k !== `${r},${c}`);
    afterMove();
  }
}

function undo() {
  if (isLocked()) return;
  const record = game.undo.pop();
  if (!record) { toast('Không còn bước nào để hoàn tác'); return; }
  for (const [r, c, v, n] of record) { game.values[r][c] = v; game.notes[r][c] = n; wrong.delete(`${r},${c}`); }
  selected = [record[0][0], record[0][1]];
  afterMove(false);
}

function hint() {
  if (isLocked()) return;
  const sol = (r, c) => model.cells[r][c].solution;
  let target = null;
  if (selected && game.values[selected[0]][selected[1]] !== sol(...selected)) target = selected;
  if (!target) target = model.whites.find(([r, c]) => game.values[r][c] && game.values[r][c] !== sol(r, c));
  if (!target) {
    // Ô trống thuộc dãy ngắn nhất (dễ suy luận nhất).
    let best = Infinity;
    for (const [r, c] of model.whites) {
      if (game.values[r][c]) continue;
      const cell = model.cells[r][c];
      const score = Math.min(model.runs[cell.hRun].cells.length, model.runs[cell.vRun].cells.length);
      if (score < best) { best = score; target = [r, c]; }
    }
  }
  if (!target) return;
  const [r, c] = target;
  applyChanges([[r, c, sol(r, c), 0]]);
  game.hinted.push(`${r},${c}`);
  game.hints++;
  selected = [r, c];
  toast(`Gợi ý: ô hàng ${r}, cột ${c} là ${sol(r, c)}`);
  afterMove();
}

function check() {
  if (isLocked()) return;
  wrong = new Set();
  for (const [r, c] of model.whites) {
    const v = game.values[r][c];
    if (v && v !== model.cells[r][c].solution) wrong.add(`${r},${c}`);
  }
  const empty = model.whites.filter(([r, c]) => !game.values[r][c]).length;
  if (wrong.size) toast(`Có ${wrong.size} ô sai (đánh dấu màu đỏ)`, { tone: 'bad' });
  else toast(empty ? `Chưa có ô sai · còn ${empty} ô trống` : 'Không có ô sai', { tone: 'ok' });
  refresh();
}

function afterMove(checkWin = true) {
  if (checkWin && isSolved(model, game.values)) {
    game.status = 'won';
    stopwatch.stop();
    selected = null;
    if (!saveData.solved.includes(model.id)) saveData.solved.push(model.id);
    persist();
    refresh();
    const next = nextPuzzleId();
    resultDialog('Giải xong!', `Đề “${model.name}” · Thời gian: ${formatTime(game.elapsed)}` + (game.hints ? ` · ${game.hints} gợi ý` : ''), 'win',
      { againLabel: next ? 'Đề tiếp theo' : 'Chọn đề' })
      .then((v) => { if (v === 'again' && next) openPuzzle(next); });
    return;
  }
  persist();
  refresh();
}

function nextPuzzleId() {
  const idx = VERIFIED.findIndex((p) => p.id === model.id);
  for (let k = 1; k <= VERIFIED.length; k++) {
    const cand = VERIFIED[(idx + k) % VERIFIED.length];
    if (!saveData.solved.includes(cand.id)) return cand.id;
  }
  return VERIFIED[(idx + 1) % VERIFIED.length].id;
}

/* ---------------- Giao diện ---------------- */

function refresh() {
  if (!game) return;
  board.redraw();
  const locked = isLocked();
  document.querySelectorAll('#numpad button, .tools .btn').forEach((b) => { b.disabled = locked; });
  $('btn-undo').disabled = locked || game.undo.length === 0;
  $('btn-notes').classList.toggle('is-on', noteMode);
  $('btn-notes').setAttribute('aria-pressed', String(noteMode));
  $('opt-showConflicts').checked = settings.showConflicts;

  const select = $('puzzle-select');
  select.replaceChildren(...VERIFIED.map((p) => el('option', { value: p.id, selected: p.id === model.id },
    `${saveData.solved.includes(p.id) ? '✓ ' : ''}${p.name} · ${p.difficulty} · ${p.rows[0].length - 1}×${p.rows.length - 1}`)));

  const filled = model.whites.filter(([r, c]) => game.values[r][c]).length;
  $('chip-progress').innerHTML = `<span class="label">Đã điền</span> ${filled}/${model.whites.length}`;
  $('chip-level').innerHTML = `<span class="label">Đề</span> ${model.name} · ${model.difficulty}`;
  const stateChip = $('chip-state');
  if (game.status === 'won') { stateChip.className = 'chip ok'; stateChip.textContent = 'Đã giải xong'; }
  else if (noteMode) { stateChip.className = 'chip warn'; stateChip.textContent = 'Chế độ ghi chú'; }
  else { stateChip.className = 'chip'; stateChip.innerHTML = '<span class="label">Nhập</span> Số'; }
  $('solved-info').textContent = `Đã giải ${saveData.solved.length}/${VERIFIED.length} đề.`;

  // Trợ giúp tổ hợp cho ô đang chọn.
  const help = $('combo-help');
  if (selected && !locked) {
    const cell = model.cells[selected[0]][selected[1]];
    const line = (label, run) => {
      const combos = combinations(run.sum, run.cells.length);
      const text = combos.length > 6 ? `${combos.length} tổ hợp` : combos.map((cmb) => cmb.join('+')).join(' · ');
      return el('div', {}, el('b', {}, `${label}: `), `tổng ${run.sum} trong ${run.cells.length} ô → ${text}`);
    };
    help.replaceChildren(line('Ngang', model.runs[cell.hRun]), line('Dọc', model.runs[cell.vRun]));
  } else {
    help.replaceChildren(el('span', {}, 'Chọn một ô trắng để xem các tổ hợp chữ số có thể dùng.'));
  }
}

function boardView() {
  const { conflicts, runState } = analyzeEntries(model, game.values);
  return {
    model,
    values: game.values,
    notes: game.notes,
    selected: isLocked() ? null : selected,
    conflicts: settings.showConflicts ? conflicts : new Set(),
    runState: settings.showConflicts ? runState : runState.map((s) => ({ ...s, wrongSum: false, full: false })),
    wrong,
    hinted: new Set(game.hinted),
    won: game.status === 'won',
  };
}

const board = createBoard($('board'), {
  reserveHeight: 56,
  layout: (w, h) => (model ? layout(model, w, h) : { width: w, height: w }),
  draw: (p, w, h) => { if (model && game) drawKakuro(p, w, h, boardView(), colors); },
  onPress: ({ x, y }) => {
    if (isLocked() || !model) return;
    const hit = hitTest(model, x, y, board.size.width);
    if (hit && isWhite(...hit)) { selected = hit; refresh(); }
  },
});

window.addEventListener('themechange', () => { colors = readThemeColors(COLOR_NAMES); board.redraw(); });

async function restart() {
  if (hasProgress() && game.status === 'playing' &&
    !(await confirmDialog('Xóa tiến trình đề này?', 'Mọi số đã điền và ghi chú của đề hiện tại sẽ bị xóa.', { confirmLabel: 'Chơi lại', danger: true }))) return;
  Object.assign(game, { values: emptyGrid(), notes: emptyGrid(), hinted: [], hints: 0, undo: [], status: 'playing' });
  selected = null;
  wrong = new Set();
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
  'new-game': () => { openPuzzle(nextPuzzleId()); toast(`Đề: ${model.name}`); },
  restart,
});

$('puzzle-select').addEventListener('change', (e) => openPuzzle(e.target.value));
$('opt-showConflicts').addEventListener('change', (e) => {
  settings.showConflicts = e.target.checked;
  saveSettings('kakuro', settings);
  refresh();
});

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
  const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (e.key in dirs) {
    e.preventDefault();
    if (!selected) { selected = model.whites[0]; refresh(); return; }
    const [dr, dc] = dirs[e.key];
    let [r, c] = selected;
    for (;;) {
      r += dr; c += dc;
      if (r < 0 || c < 0 || r >= model.height || c >= model.width) break;
      if (isWhite(r, c)) { selected = [r, c]; break; }
    }
    refresh();
  } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { e.preventDefault(); erase(); }
  else if (e.key.toLowerCase() === 'n') { noteMode = !noteMode; refresh(); }
  else if (e.key === 'Escape') { selected = null; refresh(); }
});

window.addEventListener('pagehide', persist);

openPuzzle(saveData.current);
