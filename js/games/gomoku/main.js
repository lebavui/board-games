// Điều khiển trang Cờ caro: hai người trên cùng thiết bị hoặc chơi với máy.
import { initPage, confirmDialog, resultDialog, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { AIPlayer } from '../../common/ai-client.js';
import { mountOpponentControls, sanitizeOpponent, defaultOpponent, AI_LEVEL_LABELS } from '../../common/opponent.js';
import { createGame, fromMoves, play, undo as undoMove, currentPlayer, coordName, COLOR_NAMES, BLACK, WHITE, SIZE } from './logic.js';
import { drawGomoku, layout, pointAt } from './view.js';

const SAVE_KEY = 'gomoku:game';
const SAVE_VERSION = 2; // v2: thêm cấu hình đối thủ (opponent)
const SIDE = { b: BLACK, w: WHITE };

initPage('gomoku');

const settings = loadSettings('gomoku', { showCoords: true, opponent: defaultOpponent('b') });
settings.opponent = sanitizeOpponent(settings.opponent, ['b', 'w'], defaultOpponent('b'));
const $ = (id) => document.getElementById(id);

const ai = new AIPlayer('gomoku');
let opponent = settings.opponent;
let game = restore();
let thinking = false;

function restore() {
  const data = load(SAVE_KEY, {
    version: SAVE_VERSION,
    migrate: (v, old) => (v === 1 && Array.isArray(old?.moves) ? { ...old, opponent: defaultOpponent('b') } : null),
  });
  if (data && Array.isArray(data.moves)) {
    opponent = sanitizeOpponent(data.opponent, ['b', 'w'], settings.opponent);
    return fromMoves(data.moves.filter((i) => Number.isInteger(i) && i >= 0 && i < SIZE * SIZE));
  }
  return createGame();
}

function persist() {
  save(SAVE_KEY, { moves: game.moves, opponent }, SAVE_VERSION);
}

const vsAI = () => opponent.mode === 'ai';
const humanColor = () => SIDE[opponent.human];
const isAITurn = () => vsAI() && !game.result && currentPlayer(game) !== humanColor();
const sideName = (color) => (vsAI() ? (color === humanColor() ? 'Bạn' : 'Máy') : COLOR_NAMES[color]);

function placed() {
  persist();
  refresh();
  if (game.result) announce();
  else maybeAIMove();
}

async function maybeAIMove() {
  if (!isAITurn() || thinking) return;
  thinking = true;
  refresh();
  const move = await ai.think([game.board, currentPlayer(game), opponent.level], { minDelay: 350 });
  thinking = false;
  if (move == null || !isAITurn()) { refresh(); return; }
  play(game, move);
  placed();
}

function stopAI() {
  ai.cancel();
  thinking = false;
}

function announce() {
  const { winner } = game.result;
  const again = (v) => { if (v === 'again') newGame(); };
  if (!winner) {
    resultDialog('Hòa', 'Bàn cờ đã đầy mà chưa ai có năm quân liên tiếp.', 'draw').then(again);
    return;
  }
  const detail = `${sideName(winner)} có ${game.result.line.length} quân liên tiếp sau ${game.moves.length} nước.`;
  if (vsAI()) {
    const humanWon = winner === humanColor();
    resultDialog(humanWon ? 'Bạn thắng!' : 'Máy thắng!', detail, humanWon ? 'win' : 'lose').then(again);
  } else {
    resultDialog(`${COLOR_NAMES[winner]} thắng!`, detail, 'win').then(again);
  }
}

function newGame() {
  stopAI();
  game = createGame();
  persist();
  refresh();
  maybeAIMove();
}

function undo() {
  stopAI();
  let removed = 0;
  // Chơi với máy: lùi đến lượt trước của người chơi (gồm cả nước của máy).
  while (game.moves.length && (removed === 0 || (vsAI() && currentPlayer(game) !== humanColor()))) {
    undoMove(game);
    removed++;
  }
  if (!removed) return;
  persist();
  refresh();
  maybeAIMove();
}

/* ---------------- Giao diện ---------------- */

const opponentUI = mountOpponentControls($('opponent'), {
  sides: [['b', 'Đen (đi trước)'], ['w', 'Trắng']],
  onChange: async (field, value) => {
    if (field === 'level') {
      opponent = { ...opponent, level: value };
      settings.opponent = opponent;
      saveSettings('gomoku', settings);
      persist();
      refresh();
      return;
    }
    if (game.moves.length && !game.result &&
      !(await confirmDialog('Đổi chế độ chơi?', 'Thay đổi này sẽ bắt đầu ván mới; ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    opponent = { ...opponent, [field]: value };
    settings.opponent = opponent;
    saveSettings('gomoku', settings);
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
  if (game.result) {
    const { winner } = game.result;
    turnBox.className = 'turn over';
    stone.className = `stone ${winner === BLACK ? 'black' : 'white'}`;
    stone.style.visibility = winner ? 'visible' : 'hidden';
    title.textContent = !winner ? 'Hòa' : vsAI() ? (winner === humanColor() ? 'Bạn thắng' : 'Máy thắng') : `${COLOR_NAMES[winner]} thắng`;
    sub.textContent = 'Ván đã kết thúc';
  } else {
    const player = currentPlayer(game);
    turnBox.className = 'turn';
    stone.className = `stone ${player === BLACK ? 'black' : 'white'}`;
    stone.style.visibility = 'visible';
    if (thinking) {
      title.innerHTML = 'Máy đang nghĩ<span class="thinking"><i></i><i></i><i></i></span>';
      sub.textContent = `Máy cầm quân ${COLOR_NAMES[player]} · mức ${AI_LEVEL_LABELS[opponent.level]}`;
    } else {
      title.textContent = vsAI() ? `Lượt ${sideName(player).toLowerCase()} (${COLOR_NAMES[player]})` : `Lượt ${COLOR_NAMES[player]}`;
      sub.textContent = `Nước thứ ${game.moves.length + 1} · còn ${SIZE * SIZE - game.moves.length} giao điểm trống`;
    }
  }

  const list = $('history');
  const moves = game.moves;
  if (!moves.length) list.replaceChildren(el('li', { class: 'history-empty' }, 'Chưa có nước đi nào.'));
  else {
    const rows = [];
    for (let k = 0; k < moves.length; k += 2) {
      rows.push(el('li', {},
        el('span', { class: 'no' }, `${k / 2 + 1}.`),
        el('span', { class: k === moves.length - 1 ? 'last' : '' }, coordName(moves[k])),
        el('span', { class: k + 1 === moves.length - 1 ? 'last' : '' }, moves[k + 1] !== undefined ? coordName(moves[k + 1]) : '')));
    }
    list.replaceChildren(...rows);
    list.scrollTop = list.scrollHeight;
  }
  // Với máy: chỉ hoàn tác được khi đã có ít nhất một nước của người chơi.
  const humanMoves = vsAI() ? moves.filter((_, k) => (k % 2 === 0 ? BLACK : WHITE) === humanColor()).length : moves.length;
  $('btn-undo').disabled = humanMoves === 0;
  $('opt-coords').checked = settings.showCoords;
}

const board = createBoard($('board'), {
  layout,
  draw: (p, w) => drawGomoku(p, w, {
    board: game.board,
    lastMove: game.moves.length ? game.moves[game.moves.length - 1] : -1,
    winLine: game.result?.line || null,
    showCoords: settings.showCoords,
  }),
  onPress: ({ x, y }) => {
    if (game.result || thinking || isAITurn()) return;
    const i = pointAt(x, y, board.size.width);
    if (i < 0 || !play(game, i)) return;
    placed();
  },
});

bindActions(document.querySelector('.game-layout'), {
  'new-game': async () => {
    if (game.moves.length && !game.result &&
      !(await confirmDialog('Chơi lại từ đầu?', 'Ván đang chơi sẽ bị xóa.', { confirmLabel: 'Chơi lại', danger: true }))) return;
    newGame();
  },
  undo,
});

$('opt-coords').addEventListener('change', (e) => {
  settings.showCoords = e.target.checked;
  saveSettings('gomoku', settings);
  refresh();
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!$('btn-undo').disabled) undo(); }
});

refresh();
maybeAIMove();
