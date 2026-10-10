// Điều khiển trang Cờ đam: hai người trên cùng thiết bị hoặc chơi với máy.
import { initPage, confirmDialog, resultDialog, toast, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { AIPlayer } from '../../common/ai-client.js';
import { mountOpponentControls, sanitizeOpponent, defaultOpponent, AI_LEVEL_LABELS } from '../../common/opponent.js';
import { initialState, legalSteps, applyStep, notation, countPieces, COLOR_NAMES, colorOf } from './logic.js';
import { evaluateFor } from './ai.js';
import { drawCheckers, layout, squareAt } from './view.js';

const SAVE_KEY = 'checkers:game';
const SAVE_VERSION = 2; // v2: thêm cấu hình đối thủ (opponent)
const STEP_DELAY = 380;  // ms giữa các bước nhảy của máy để người chơi theo dõi được

initPage('checkers');

const settings = loadSettings('checkers', { flipped: false, showNumbers: false, opponent: defaultOpponent('r') });
settings.opponent = sanitizeOpponent(settings.opponent, ['b', 'r'], defaultOpponent('r'));
const $ = (id) => document.getElementById(id);

const ai = new AIPlayer('checkers');
let opponent = settings.opponent;
// undoStack: các trạng thái tại đầu mỗi lượt (để hoàn tác cả chuỗi nhảy).
let { state, undoStack } = restore();
let selected = null;
let thinking = false;

function restore() {
  const data = load(SAVE_KEY, {
    version: SAVE_VERSION,
    migrate: (v, old) => (v === 1 && old?.state ? { ...old, opponent: defaultOpponent('r') } : null),
  });
  if (data && Array.isArray(data.state?.board) && data.state.board.length === 64) {
    opponent = sanitizeOpponent(data.opponent, ['b', 'r'], settings.opponent);
    return { state: data.state, undoStack: data.undo || [] };
  }
  return { state: initialState(), undoStack: [] };
}

function persist() {
  undoStack = undoStack.slice(-200);
  save(SAVE_KEY, { state, undo: undoStack, opponent }, SAVE_VERSION);
}

const isOver = () => !!state.result;
const vsAI = () => opponent.mode === 'ai';
const aiColor = () => (vsAI() ? (opponent.human === 'b' ? 'r' : 'b') : null);
const isAITurn = () => vsAI() && !isOver() && state.turn === aiColor();
const sideName = (color) => (vsAI() ? (color === opponent.human ? 'Bạn' : 'Máy') : COLOR_NAMES[color]);
const isFlipped = () => (vsAI() ? (opponent.human === 'b') !== settings.flipped : settings.flipped);

function stepsFor(i) {
  return legalSteps(state).filter((s) => s.from === i);
}

function movablePieces() {
  return new Set(legalSteps(state).map((s) => s.from));
}

function doStep(step) {
  if (state.forced === null) undoStack.push(state); // bắt đầu một lượt mới
  const next = applyStep(state, step);
  if (!next) return false;
  state = next;
  selected = state.forced;
  persist();
  refresh();
  if (state.result) announce();
  return true;
}

function humanStep(step) {
  doStep(step);
  if (state.forced !== null && !state.result) toast('Bắt buộc nhảy tiếp bằng quân này');
  maybeAIMove();
}

async function maybeAIMove() {
  if (!isAITurn() || thinking) return;
  thinking = true;
  refresh();
  const steps = await ai.think([state, opponent.level]);
  if (!steps || !isAITurn()) { thinking = false; refresh(); return; }
  const token = ai.seq;
  for (let k = 0; k < steps.length; k++) {
    if (k > 0) {
      await new Promise((r) => setTimeout(r, STEP_DELAY));
      if (token !== ai.seq) return; // bị hủy giữa chuỗi nhảy (hoàn tác / ván mới)
    }
    if (!doStep(steps[k])) break;
  }
  thinking = false;
  selected = null;
  refresh();
}

function stopAI() {
  ai.cancel();
  thinking = false;
}

function announce() {
  const { winner, reason } = state.result;
  const loser = winner === 'b' ? 'r' : 'b';
  const reasons = {
    'no-pieces': `${sideName(loser)} đã hết quân.`,
    'no-moves': `${sideName(loser)} không còn nước đi hợp lệ.`,
    resign: `${sideName(loser)} đầu hàng.`,
    agreement: vsAI() ? 'Máy đồng ý hòa.' : 'Hai bên đồng ý hòa.',
  };
  let title = winner ? `${COLOR_NAMES[winner]} thắng!` : 'Hòa';
  let tone = winner ? 'win' : 'draw';
  if (vsAI() && winner) {
    title = winner === opponent.human ? 'Bạn thắng!' : 'Máy thắng!';
    tone = winner === opponent.human ? 'win' : 'lose';
  }
  resultDialog(title, reasons[reason], tone).then((v) => { if (v === 'again') newGame(); });
}

function newGame() {
  stopAI();
  state = initialState();
  undoStack = [];
  selected = null;
  persist();
  refresh();
  maybeAIMove();
}

function undo() {
  stopAI();
  // Quay về đầu lượt gần nhất của người chơi (hai người: đầu lượt trước / lượt đang nhảy dở).
  let prev = undoStack.pop();
  if (vsAI()) while (prev && prev.turn !== opponent.human) prev = undoStack.pop();
  if (!prev) { refresh(); maybeAIMove(); return; }
  state = prev;
  selected = state.forced;
  persist();
  refresh();
  maybeAIMove();
}

/* ---------------- Giao diện ---------------- */

const opponentUI = mountOpponentControls($('opponent'), {
  sides: [['b', 'Đen (đi trước)'], ['r', 'Đỏ']],
  onChange: async (field, value) => {
    if (field === 'level') {
      opponent = { ...opponent, level: value };
      settings.opponent = opponent;
      saveSettings('checkers', settings);
      persist();
      refresh();
      return;
    }
    if (state.moves.length && !isOver() &&
      !(await confirmDialog('Đổi chế độ chơi?', 'Thay đổi này sẽ bắt đầu ván mới; ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    opponent = { ...opponent, [field]: value };
    settings.opponent = opponent;
    settings.flipped = false;
    saveSettings('checkers', settings);
    newGame();
  },
});

function refresh() {
  board.redraw();
  opponentUI.update(opponent);
  const turnBox = $('turn');
  const stone = turnBox.querySelector('.stone');
  const title = turnBox.querySelector('.turn-title');
  const sub = turnBox.querySelector('.turn-sub');
  if (state.result) {
    const { winner } = state.result;
    turnBox.className = 'turn over';
    stone.className = `stone ${winner === 'b' ? 'black' : 'red'}`;
    stone.style.visibility = winner ? 'visible' : 'hidden';
    title.textContent = !winner ? 'Hòa' : vsAI() ? (winner === opponent.human ? 'Bạn thắng' : 'Máy thắng') : `${COLOR_NAMES[winner]} thắng`;
    sub.textContent = 'Ván đã kết thúc';
  } else {
    const mustCapture = legalSteps(state).some((s) => s.capture !== null);
    turnBox.className = `turn ${mustCapture && !isAITurn() ? 'alert' : ''}`;
    stone.className = `stone ${state.turn === 'b' ? 'black' : 'red'}`;
    stone.style.visibility = 'visible';
    if (thinking) {
      title.innerHTML = 'Máy đang nghĩ<span class="thinking"><i></i><i></i><i></i></span>';
      sub.textContent = `Máy cầm quân ${COLOR_NAMES[aiColor()]} · mức ${AI_LEVEL_LABELS[opponent.level]}`;
    } else {
      title.textContent = vsAI() ? `Lượt ${sideName(state.turn).toLowerCase()} (${COLOR_NAMES[state.turn]})` : `Lượt ${COLOR_NAMES[state.turn]}`;
      sub.textContent = state.forced !== null ? 'Đang nhảy liên tiếp — phải bắt tiếp' : mustCapture ? 'Bắt buộc bắt quân' : 'Chọn quân để đi';
    }
  }

  const count = countPieces(state.board);
  $('label-b').textContent = vsAI() ? `Đen (${sideName('b')})` : 'Đen';
  $('label-r').textContent = vsAI() ? `Đỏ (${sideName('r')})` : 'Đỏ';
  $('count-b').textContent = `${count.b} quân${count.bk ? ` (${count.bk} vua)` : ''}`;
  $('count-r').textContent = `${count.r} quân${count.rk ? ` (${count.rk} vua)` : ''}`;

  const list = $('history');
  const moves = state.moves;
  if (!moves.length) list.replaceChildren(el('li', { class: 'history-empty' }, 'Chưa có nước đi nào.'));
  else {
    const rows = [];
    for (let k = 0; k < moves.length; k += 2) {
      rows.push(el('li', {},
        el('span', { class: 'no' }, `${k / 2 + 1}.`),
        el('span', { class: k === moves.length - 1 ? 'last' : '' }, notation(moves[k]) + (moves[k].crowned ? ' ♔' : '')),
        el('span', { class: k + 1 === moves.length - 1 ? 'last' : '' }, moves[k + 1] ? notation(moves[k + 1]) + (moves[k + 1].crowned ? ' ♔' : '') : '')));
    }
    list.replaceChildren(...rows);
    list.scrollTop = list.scrollHeight;
  }
  const canUndo = vsAI() ? undoStack.some((s) => s.turn === opponent.human) : undoStack.length > 0;
  $('btn-undo').disabled = !canUndo;
  $('btn-draw').disabled = isOver() || thinking;
  $('btn-draw').textContent = vsAI() ? 'Đề nghị hòa' : 'Hòa thỏa thuận';
  $('btn-resign').disabled = isOver();
  $('opt-numbers').checked = settings.showNumbers;
}

const board = createBoard($('board'), {
  layout,
  draw: (p, w) => {
    const lastPath = state.path ? state.path.squares : state.moves.length ? state.moves[state.moves.length - 1].squares : null;
    const humanTurn = !isOver() && !isAITurn();
    const steps = humanTurn && selected !== null ? stepsFor(selected) : [];
    const mustCapture = humanTurn && legalSteps(state).some((s) => s.capture !== null);
    drawCheckers(p, w, {
      board: state.board,
      flipped: isFlipped(),
      selected: humanTurn ? selected : null,
      targets: steps.map((s) => s.to),
      movable: mustCapture && selected === null ? movablePieces() : new Set(),
      lastPath,
      showNumbers: settings.showNumbers,
    });
  },
  onPress: ({ x, y }) => {
    if (isOver() || thinking || isAITurn()) return;
    const i = squareAt(x, y, board.size.width, isFlipped());
    if (i < 0) return;
    if (selected !== null) {
      const step = stepsFor(selected).find((s) => s.to === i);
      if (step) { humanStep(step); return; }
    }
    if (state.forced !== null) { toast('Phải tiếp tục nhảy bằng quân đang chọn'); return; }
    if (colorOf(state.board[i]) === state.turn) {
      if (stepsFor(i).length) selected = i;
      else {
        selected = null;
        if (legalSteps(state).some((s) => s.capture !== null)) toast('Bắt buộc bắt quân — chọn quân đang được tô sáng');
      }
    } else selected = null;
    board.redraw();
  },
});

function endWith(result) {
  stopAI();
  undoStack.push(state);
  state = { ...state, forced: null, path: null, result };
  selected = null;
  persist();
  refresh();
  announce();
}

bindActions(document.querySelector('.game-layout'), {
  'new-game': async () => {
    if (state.moves.length && !isOver() &&
      !(await confirmDialog('Bắt đầu ván mới?', 'Ván cờ đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    newGame();
  },
  undo,
  flip: () => { settings.flipped = !settings.flipped; saveSettings('checkers', settings); refresh(); },
  draw: async () => {
    if (vsAI()) {
      if (!(await confirmDialog('Đề nghị hòa?', 'Máy sẽ chấp nhận nếu nó không có lợi thế.', { confirmLabel: 'Đề nghị' }))) return;
      if (evaluateFor(state, aiColor()) > 20) { toast('Máy từ chối hòa'); return; }
    } else if (!(await confirmDialog('Hòa thỏa thuận?', 'Cả hai người chơi đồng ý kết thúc ván với kết quả hòa?', { confirmLabel: 'Đồng ý hòa' }))) return;
    endWith({ winner: null, reason: 'agreement' });
  },
  resign: async () => {
    const color = vsAI() ? opponent.human : state.turn;
    const who = vsAI() ? 'Bạn' : COLOR_NAMES[color];
    const detail = vsAI() ? 'Bạn sẽ thua ván này.' : `${who} (bên đang có lượt) sẽ thua ván này.`;
    if (!(await confirmDialog(`${who} đầu hàng?`, detail, { confirmLabel: 'Đầu hàng', danger: true }))) return;
    endWith({ winner: color === 'b' ? 'r' : 'b', reason: 'resign' });
  },
});

$('opt-numbers').addEventListener('change', (e) => {
  settings.showNumbers = e.target.checked;
  saveSettings('checkers', settings);
  refresh();
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!$('btn-undo').disabled) undo(); }
});

// Khôi phục ván đang nhảy dở: tự chọn quân bắt buộc; nếu đến lượt máy thì để máy đi tiếp.
selected = state.forced;
refresh();
maybeAIMove();
