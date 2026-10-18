// Điều khiển trang Cờ tướng: hai người trên cùng thiết bị hoặc chơi với máy.
import { initPage, confirmDialog, resultDialog, toast, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { AIPlayer } from '../../common/ai-client.js';
import { mountOpponentControls, sanitizeOpponent, defaultOpponent, AI_LEVEL_LABELS } from '../../common/opponent.js';
import { initialState, legalMoves, applyMove, replay, inCheck, findKing, capturedPieces, colorOf, kindOf, COLOR_NAMES, PIECE_NAMES, NO_CAPTURE_LIMIT } from './logic.js';
import { evaluateFor } from './ai.js';
import { drawXiangqi, layout, pointAt } from './view.js';

const SAVE_KEY = 'xiangqi:game';
const SAVE_VERSION = 1;

initPage('xiangqi');

const settings = loadSettings('xiangqi', { flipped: false, han: true, opponent: defaultOpponent('r') });
settings.opponent = sanitizeOpponent(settings.opponent, ['r', 'b'], defaultOpponent('r'));
const $ = (id) => document.getElementById(id);

const ai = new AIPlayer('xiangqi');
let opponent = settings.opponent;
let manual = null;   // kết quả do người chơi quyết định (đầu hàng / hòa thỏa thuận)
let state = restore();
let selected = -1;
let thinking = false;
let geo = { cell: 40 };

function restore() {
  const data = load(SAVE_KEY, { version: SAVE_VERSION });
  if (data && Array.isArray(data.moves)) {
    const s = replay(data.moves);
    if (s) {
      opponent = sanitizeOpponent(data.opponent, ['r', 'b'], settings.opponent);
      manual = data.manual && typeof data.manual === 'object' && 'winner' in data.manual ? data.manual : null;
      return s;
    }
  }
  return initialState();
}

function persist() {
  save(SAVE_KEY, { moves: state.moves.map(({ from, to }) => ({ from, to })), opponent, manual }, SAVE_VERSION);
}

const result = () => manual || state.result;
const isOver = () => !!result();
const vsAI = () => opponent.mode === 'ai';
const aiColor = () => (vsAI() ? (opponent.human === 'r' ? 'b' : 'r') : null);
const isAITurn = () => vsAI() && !isOver() && state.turn === aiColor();
const sideName = (color) => (vsAI() ? (color === opponent.human ? 'Bạn' : 'Máy') : COLOR_NAMES[color]);
const isFlipped = () => (vsAI() ? (opponent.human === 'b') !== settings.flipped : settings.flipped);

function play(move) {
  const next = applyMove(state, move);
  if (!next) return false;
  state = next;
  selected = -1;
  persist();
  refresh();
  if (state.result) announce();
  return true;
}

async function maybeAIMove() {
  if (!isAITurn() || thinking) return;
  thinking = true;
  refresh();
  const move = await ai.think([state, opponent.level]);
  thinking = false;
  if (move && isAITurn()) play(move);
  else refresh();
}

function stopAI() {
  ai.cancel();
  thinking = false;
}

function announce() {
  const { winner, reason } = result();
  const loser = winner === 'r' ? 'b' : 'r';
  const reasons = {
    checkmate: `${sideName(loser)} bị chiếu bí.`,
    stalemate: `${sideName(loser)} hết nước đi (bị vây khốn) — trong Cờ tướng như vậy là thua.`,
    resign: `${sideName(loser)} đầu hàng.`,
    agreement: vsAI() ? 'Máy đồng ý hòa.' : 'Hai bên đồng ý hòa.',
    repetition: 'Cùng một thế cờ lặp lại ba lần.',
    'no-capture': `${NO_CAPTURE_LIMIT / 2} nước liên tiếp mỗi bên không ăn quân.`,
    material: 'Cả hai bên đều không còn quân tấn công (Xe, Mã, Pháo, Tốt).',
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
  manual = null;
  selected = -1;
  persist();
  refresh();
  maybeAIMove();
}

function undo() {
  stopAI();
  selected = -1;
  if (manual) {
    manual = null; // hủy đầu hàng / hòa thỏa thuận trước
  } else {
    // Hai người: lùi một nước. Với máy: lùi tới lượt gần nhất của người chơi.
    const moves = state.moves.slice(0, -1);
    if (vsAI()) while (moves.length && (moves.length % 2 === 0 ? 'r' : 'b') !== opponent.human) moves.pop();
    state = replay(moves.map(({ from, to }) => ({ from, to }))) || initialState();
  }
  persist();
  refresh();
  maybeAIMove();
}

/* ---------------- Giao diện ---------------- */

const opponentUI = mountOpponentControls($('opponent'), {
  sides: [['r', 'Đỏ (đi trước)'], ['b', 'Đen']],
  onChange: async (field, value) => {
    if (field === 'level') {
      opponent = { ...opponent, level: value };
      settings.opponent = opponent;
      saveSettings('xiangqi', settings);
      persist();
      refresh();
      return;
    }
    if (state.moves.length && !isOver() &&
      !(await confirmDialog('Đổi chế độ chơi?', 'Thay đổi này sẽ bắt đầu ván mới; ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    opponent = { ...opponent, [field]: value };
    settings.opponent = opponent;
    settings.flipped = false;
    saveSettings('xiangqi', settings);
    newGame();
  },
});

const pieceLabel = (p) => (settings.han ? { r: '帥仕相傌俥炮兵', b: '將士象馬車砲卒' }[colorOf(p)]['kabnrcp'.indexOf(kindOf(p))] : PIECE_NAMES[kindOf(p)]);

function refresh() {
  board.redraw();
  opponentUI.update(opponent);
  const turnBox = $('turn');
  const stone = turnBox.querySelector('.stone');
  const title = turnBox.querySelector('.turn-title');
  const sub = turnBox.querySelector('.turn-sub');
  const res = result();
  if (res) {
    const { winner } = res;
    turnBox.className = 'turn over';
    stone.className = `stone ${winner === 'r' ? 'red' : 'black'}`;
    stone.style.visibility = winner ? 'visible' : 'hidden';
    title.textContent = !winner ? 'Hòa' : vsAI() ? (winner === opponent.human ? 'Bạn thắng' : 'Máy thắng') : `${COLOR_NAMES[winner]} thắng`;
    sub.textContent = 'Ván đã kết thúc';
  } else {
    const check = inCheck(state.board, state.turn);
    turnBox.className = `turn ${check ? 'alert' : ''}`;
    stone.className = `stone ${state.turn === 'r' ? 'red' : 'black'}`;
    stone.style.visibility = 'visible';
    if (thinking) {
      title.innerHTML = 'Máy đang nghĩ<span class="thinking"><i></i><i></i><i></i></span>';
      sub.textContent = `Máy cầm quân ${COLOR_NAMES[aiColor()]} · mức ${AI_LEVEL_LABELS[opponent.level]}`;
    } else {
      title.textContent = vsAI() ? `Lượt ${sideName(state.turn).toLowerCase()} (${COLOR_NAMES[state.turn]})` : `Lượt ${COLOR_NAMES[state.turn]}`;
      sub.textContent = check ? 'Đang bị chiếu — phải chống chiếu' : 'Chọn quân để đi';
    }
  }

  const taken = capturedPieces(state);
  // Quân bị ăn của Đen là chiến lợi phẩm của Đỏ và ngược lại.
  for (const [color, lost] of [['r', taken.b], ['b', taken.r]]) {
    $(`label-${color}`).textContent = vsAI() ? `${COLOR_NAMES[color]} (${sideName(color)}) đã ăn` : `${COLOR_NAMES[color]} đã ăn`;
    $(`taken-${color}`).textContent = lost.length ? lost.map(pieceLabel).join(settings.han ? ' ' : ', ') : '—';
  }

  const list = $('history');
  const moves = state.moves;
  if (!moves.length) list.replaceChildren(el('li', { class: 'history-empty' }, 'Chưa có nước đi nào.'));
  else {
    const text = (m) => m.text + (m.check ? '+' : '');
    const rows = [];
    for (let k = 0; k < moves.length; k += 2) {
      rows.push(el('li', {},
        el('span', { class: 'no' }, `${k / 2 + 1}.`),
        el('span', { class: k === moves.length - 1 ? 'last' : '' }, text(moves[k])),
        el('span', { class: k + 1 === moves.length - 1 ? 'last' : '' }, moves[k + 1] ? text(moves[k + 1]) : '')));
    }
    list.replaceChildren(...rows);
    list.scrollTop = list.scrollHeight;
  }
  const canUndo = manual ? true : vsAI() ? state.moves.length > (opponent.human === 'r' ? 0 : 1) : state.moves.length > 0;
  $('btn-undo').disabled = !canUndo;
  $('btn-draw').disabled = isOver() || thinking;
  $('btn-draw').textContent = vsAI() ? 'Đề nghị hòa' : 'Hòa thỏa thuận';
  $('btn-resign').disabled = isOver();
  $('opt-han').checked = settings.han;
}

function targetsOf(from) {
  return legalMoves(state).filter((m) => m.from === from).map((m) => ({ to: m.to, capture: !!state.board[m.to] }));
}

const board = createBoard($('board'), {
  layout: (w, h) => {
    geo = layout(w, h);
    return geo;
  },
  draw: (p) => {
    const humanTurn = !isOver() && !isAITurn();
    const last = state.moves[state.moves.length - 1];
    drawXiangqi(p, geo, {
      board: state.board,
      flipped: isFlipped(),
      han: settings.han,
      selected: humanTurn ? selected : -1,
      targets: humanTurn && selected >= 0 ? targetsOf(selected) : [],
      lastMove: last || null,
      checkKing: !manual && inCheck(state.board, state.turn) ? findKing(state.board, state.turn) : -1,
    });
  },
  onPress: ({ x, y }) => {
    if (isOver() || thinking || isAITurn()) return;
    const i = pointAt(x, y, geo.cell, isFlipped());
    if (i < 0) return;
    if (selected >= 0 && i !== selected) {
      const move = legalMoves(state).find((m) => m.from === selected && m.to === i);
      if (move) {
        play(move);
        maybeAIMove();
        return;
      }
    }
    if (colorOf(state.board[i]) === state.turn && i !== selected) {
      selected = i;
      if (!targetsOf(i).length) toast(inCheck(state.board, state.turn) ? 'Quân này không chống được chiếu' : 'Quân này không có nước đi hợp lệ');
    } else selected = -1;
    board.redraw();
  },
});

function endWith(res) {
  stopAI();
  manual = res;
  selected = -1;
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
  flip: () => { settings.flipped = !settings.flipped; saveSettings('xiangqi', settings); refresh(); },
  draw: async () => {
    if (vsAI()) {
      if (!(await confirmDialog('Đề nghị hòa?', 'Máy sẽ chấp nhận nếu nó không có lợi thế.', { confirmLabel: 'Đề nghị' }))) return;
      if (evaluateFor(state, aiColor()) > 50) { toast('Máy từ chối hòa'); return; }
    } else if (!(await confirmDialog('Hòa thỏa thuận?', 'Cả hai người chơi đồng ý kết thúc ván với kết quả hòa?', { confirmLabel: 'Đồng ý hòa' }))) return;
    endWith({ winner: null, reason: 'agreement' });
  },
  resign: async () => {
    const color = vsAI() ? opponent.human : state.turn;
    const who = vsAI() ? 'Bạn' : COLOR_NAMES[color];
    const detail = vsAI() ? 'Bạn sẽ thua ván này.' : `${who} (bên đang có lượt) sẽ thua ván này.`;
    if (!(await confirmDialog(`${who} đầu hàng?`, detail, { confirmLabel: 'Đầu hàng', danger: true }))) return;
    endWith({ winner: color === 'r' ? 'b' : 'r', reason: 'resign' });
  },
});

$('opt-han').addEventListener('change', (e) => {
  settings.han = e.target.checked;
  saveSettings('xiangqi', settings);
  refresh();
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!$('btn-undo').disabled) undo(); }
  if (e.key === 'Escape' && selected >= 0) { selected = -1; board.redraw(); }
});

refresh();
maybeAIMove();
