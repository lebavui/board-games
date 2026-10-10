// Điều khiển trang Cờ vua: hai người trên cùng thiết bị hoặc chơi với máy.
import { initPage, confirmDialog, resultDialog, showDialog, toast, bindActions, el } from '../../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../../common/storage.js';
import { createBoard } from '../../common/p5board.js';
import { AIPlayer } from '../../common/ai-client.js';
import { mountOpponentControls, sanitizeOpponent, defaultOpponent, AI_LEVEL_LABELS } from '../../common/opponent.js';
import { ChessGame, PIECE_NAMES, COLOR_NAMES, describeResult } from './logic.js';
import { drawChess, layout, squareAt } from './view.js';
import { pieceIcon } from './pieces.js';

const SAVE_KEY = 'chess:game';
const SAVE_VERSION = 2; // v2: thêm cấu hình đối thủ (opponent)

initPage('chess');

const settings = loadSettings('chess', { flipped: false, autoFlip: false, opponent: defaultOpponent('w') });
settings.opponent = sanitizeOpponent(settings.opponent, ['w', 'b'], defaultOpponent('w'));
const $ = (id) => document.getElementById(id);

const ai = new AIPlayer('chess');
let opponent = settings.opponent;
let game = restore() || new ChessGame();
let selected = null;
let targets = [];
let busy = false;      // đang chờ chọn quân phong cấp
let thinking = false;  // máy đang tính

function restore() {
  const data = load(SAVE_KEY, {
    version: SAVE_VERSION,
    migrate: (v, old) => (v === 1 && Array.isArray(old?.moves) ? { ...old, opponent: defaultOpponent('w') } : null),
  });
  if (!data || !Array.isArray(data.moves)) return null;
  opponent = sanitizeOpponent(data.opponent, ['w', 'b'], settings.opponent);
  return new ChessGame(data.moves, data.manualResult || null);
}

function persist() {
  save(SAVE_KEY, { moves: game.serialize(), manualResult: game.manualResult, opponent }, SAVE_VERSION);
}

const vsAI = () => opponent.mode === 'ai';
const aiColor = () => (vsAI() ? (opponent.human === 'w' ? 'b' : 'w') : null);
const isAITurn = () => vsAI() && game.turn === aiColor() && !game.status().over;
const sideName = (color) => (vsAI() ? (color === opponent.human ? 'Bạn' : 'Máy') : COLOR_NAMES[color]);

function isFlipped() {
  if (vsAI()) return (opponent.human === 'b') !== settings.flipped;
  return settings.autoFlip ? game.turn === 'b' : settings.flipped;
}

function clearSelection() {
  selected = null;
  targets = [];
}

function select(square) {
  const moves = game.legalMovesFrom(square);
  if (!moves.length) { clearSelection(); return; }
  selected = square;
  // Gộp 4 nước phong cấp cùng ô đích thành một điểm đến.
  const seen = new Map();
  for (const m of moves) if (!seen.has(m.to)) seen.set(m.to, { to: m.to, capture: !!m.captured, promotion: !!m.promotion });
  targets = [...seen.values()];
}

async function choosePromotion(color) {
  const content = el('div', { class: 'promo-choices' });
  const dialogPromise = showDialog({
    title: 'Phong cấp',
    message: 'Chọn quân để phong cho tốt:',
    content,
    dismissValue: null,
    buttons: [{ label: 'Hủy', value: null, variant: 'ghost' }],
  });
  // Nút chọn quân đóng hộp thoại bằng cách bấm nút Hủy sau khi đã ghi nhận lựa chọn.
  const dialog = content.closest('dialog');
  let picked = null;
  for (const type of ['q', 'r', 'b', 'n']) {
    content.append(el('button', {
      type: 'button',
      onclick: () => { picked = type; dialog.querySelector('.modal-actions button').click(); },
    }, el('img', { src: pieceIcon(board.p, type, color, 96), alt: '', width: 56, height: 56 }), el('small', {}, PIECE_NAMES[type])));
  }
  await dialogPromise;
  return picked;
}

async function tryMove(to) {
  const target = targets.find((t) => t.to === to);
  if (!target) return false;
  const from = selected;
  let promotion;
  if (target.promotion) {
    busy = true;
    promotion = await choosePromotion(game.turn);
    busy = false;
    if (!promotion) { board.redraw(); return true; }
  }
  const move = game.move({ from, to, promotion });
  clearSelection();
  if (move) afterMove();
  return true;
}

function afterMove() {
  persist();
  refresh();
  const status = game.status();
  if (status.over) announce(status);
  else if (status.check && !isAITurn()) toast(vsAI() ? 'Bạn đang bị chiếu!' : `${COLOR_NAMES[game.turn]} đang bị chiếu!`, { tone: 'bad' });
  maybeAIMove();
}

async function maybeAIMove() {
  if (!isAITurn() || thinking) return;
  thinking = true;
  refresh();
  const move = await ai.think([game.serialize(), opponent.level]);
  thinking = false;
  // null: lượt tính bị hủy (hoàn tác, ván mới, đổi chế độ).
  if (!move || !isAITurn()) { refresh(); return; }
  game.move(move);
  afterMove();
}

function stopAI() {
  ai.cancel();
  thinking = false;
}

function announce(status) {
  const info = describeResult(status);
  if (!info) return;
  let { title, tone } = info;
  if (vsAI() && status.winner) {
    const humanWon = status.winner === opponent.human;
    title = humanWon ? 'Bạn thắng!' : 'Máy thắng!';
    tone = humanWon ? 'win' : 'lose';
  }
  resultDialog(title, info.message, tone).then((v) => { if (v === 'again') newGame(); });
}

function newGame() {
  stopAI();
  game = new ChessGame();
  clearSelection();
  persist();
  refresh();
  maybeAIMove();
}

/* ---------------- Giao diện ---------------- */

const opponentUI = mountOpponentControls($('opponent'), {
  sides: [['w', 'Trắng (đi trước)'], ['b', 'Đen']],
  onChange: async (field, value) => {
    if (field === 'level') {
      // Đổi độ khó áp dụng ngay cho các nước tiếp theo, không cần ván mới.
      opponent = { ...opponent, level: value };
      settings.opponent = opponent;
      saveSettings('chess', settings);
      persist();
      refresh();
      return;
    }
    const inProgress = game.history().length && !game.status().over;
    if (inProgress && !(await confirmDialog('Đổi chế độ chơi?', 'Thay đổi này sẽ bắt đầu ván mới; ván đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    opponent = { ...opponent, [field]: value };
    settings.opponent = opponent;
    settings.flipped = false;
    saveSettings('chess', settings);
    newGame();
  },
});

function refresh() {
  board.redraw();
  opponentUI.update(opponent);
  const status = game.status();
  const turnBox = $('turn');
  const stone = turnBox.querySelector('.stone');
  const title = turnBox.querySelector('.turn-title');
  const sub = turnBox.querySelector('.turn-sub');
  if (status.over) {
    const info = describeResult(status);
    turnBox.className = 'turn over';
    stone.className = `stone ${status.winner === 'b' ? 'black' : status.winner === 'w' ? 'white' : ''}`;
    stone.style.visibility = status.winner ? 'visible' : 'hidden';
    title.textContent = vsAI() && status.winner ? (status.winner === opponent.human ? 'Bạn thắng!' : 'Máy thắng!') : info.title;
    sub.textContent = info.message;
  } else {
    turnBox.className = `turn ${status.check ? 'alert' : ''}`;
    stone.className = `stone ${game.turn === 'w' ? 'white' : 'black'}`;
    stone.style.visibility = 'visible';
    if (thinking) title.innerHTML = 'Máy đang nghĩ<span class="thinking"><i></i><i></i><i></i></span>';
    else title.textContent = vsAI() ? `Lượt ${sideName(game.turn).toLowerCase()} (${COLOR_NAMES[game.turn]})` : `Lượt ${COLOR_NAMES[game.turn]}`;
    sub.textContent = status.check ? `${sideName(game.turn)} đang bị chiếu${game.turn === opponent.human || !vsAI() ? ' — phải đỡ chiếu' : ''}` :
      vsAI() ? `Máy: mức ${AI_LEVEL_LABELS[opponent.level]} · nước thứ ${Math.floor(game.history().length / 2) + 1}` :
        `Nước thứ ${Math.floor(game.history().length / 2) + 1}`;
  }

  // Quân bị bắt
  const captured = game.captured();
  const balance = game.materialBalance();
  const row = (color, list, adv) => {
    const holder = $(`captured-${color}`);
    if (!board.ready) return;
    holder.replaceChildren(
      el('span', { class: 'label' }, `${vsAI() ? sideName(color) : COLOR_NAMES[color]} bắt`),
      ...list.map((t) => el('img', { src: pieceIcon(board.p, t, color === 'w' ? 'b' : 'w', 48), alt: PIECE_NAMES[t], title: PIECE_NAMES[t], width: 24, height: 24 })),
      ...(adv > 0 ? [el('span', { class: 'adv' }, `+${adv}`)] : []),
    );
  };
  row('w', captured.w, balance);
  row('b', captured.b, -balance);

  // Lịch sử
  const pairs = game.sanPairs();
  const list = $('history');
  const total = game.history().length;
  if (!pairs.length) list.replaceChildren(el('li', { class: 'history-empty' }, 'Chưa có nước đi nào.'));
  else {
    list.replaceChildren(...pairs.map(([no, w, b], idx) => el('li', {},
      el('span', { class: 'no' }, `${no}.`),
      el('span', { class: total === idx * 2 + 1 ? 'last' : '' }, w),
      el('span', { class: total === idx * 2 + 2 ? 'last' : '' }, b))));
    list.scrollTop = list.scrollHeight;
  }

  const humanMoves = vsAI() ? game.history().filter((m) => m.color === opponent.human).length : total;
  $('btn-undo').disabled = humanMoves === 0 && !game.manualResult;
  $('btn-draw').disabled = status.over || thinking;
  $('btn-draw').textContent = vsAI() ? 'Đề nghị hòa' : 'Hòa thỏa thuận';
  $('btn-resign').disabled = status.over;
  $('btn-flip').disabled = !vsAI() && settings.autoFlip;
  $('opt-autoFlip').checked = settings.autoFlip;
  $('opt-autoFlip').disabled = vsAI();
  $('opt-autoFlip').closest('label').hidden = vsAI();
}

const board = createBoard($('board'), {
  layout,
  onReady: () => refresh(),
  draw: (p, w) => {
    const status = game.status();
    const last = game.lastMove();
    drawChess(p, w, {
      board: game.board(),
      flipped: isFlipped(),
      selected,
      targets,
      lastMove: last ? { from: last.from, to: last.to } : null,
      checkSquare: (status.check || status.type === 'checkmate') ? game.kingSquare(game.turn) : null,
    });
  },
  onPress: async ({ x, y }) => {
    if (busy || thinking || isAITurn() || game.status().over) return;
    const square = squareAt(x, y, board.size.width, isFlipped());
    if (!square) return;
    if (selected && square !== selected && await tryMove(square)) return;
    const piece = game.chess.get(square);
    if (piece && piece.color === game.turn && square !== selected) select(square);
    else clearSelection();
    board.redraw();
  },
});

function undo() {
  if (game.manualResult) {
    game.manualResult = null;
  } else if (vsAI()) {
    // Hoàn tác đến lượt trước của người chơi (gồm cả nước trả lời của máy).
    stopAI();
    let undone = 0;
    while (game.history().length && (undone === 0 || game.turn !== opponent.human)) {
      game.undo();
      undone++;
    }
    if (!undone) return;
  } else if (!game.undo()) return;
  clearSelection();
  persist();
  refresh();
  maybeAIMove();
}

bindActions(document.querySelector('.game-layout'), {
  'new-game': async () => {
    if (game.history().length && !game.status().over &&
      !(await confirmDialog('Bắt đầu ván mới?', 'Ván cờ đang chơi sẽ bị xóa.', { confirmLabel: 'Ván mới', danger: true }))) return;
    newGame();
  },
  undo,
  flip: () => {
    settings.flipped = !settings.flipped;
    saveSettings('chess', settings);
    refresh();
  },
  draw: async () => {
    if (vsAI()) {
      if (!(await confirmDialog('Đề nghị hòa?', 'Máy sẽ chấp nhận nếu nó không có lợi thế về quân.', { confirmLabel: 'Đề nghị' }))) return;
      const aiAdvantage = game.materialBalance() * (aiColor() === 'w' ? 1 : -1);
      if (aiAdvantage > 0) { toast('Máy từ chối hòa'); return; }
      toast('Máy đồng ý hòa');
    } else if (!(await confirmDialog('Hòa thỏa thuận?', 'Cả hai người chơi đồng ý kết thúc ván với kết quả hòa?', { confirmLabel: 'Đồng ý hòa' }))) return;
    stopAI();
    game.agreeDraw();
    afterMove();
  },
  resign: async () => {
    const color = vsAI() ? opponent.human : game.turn;
    const who = vsAI() ? 'Bạn' : COLOR_NAMES[color];
    const detail = vsAI() ? 'Bạn sẽ thua ván này.' : `${who} (bên đang có lượt) sẽ thua ván này.`;
    if (!(await confirmDialog(`${who} đầu hàng?`, detail, { confirmLabel: 'Đầu hàng', danger: true }))) return;
    stopAI();
    game.resign(color);
    afterMove();
  },
});

$('opt-autoFlip').addEventListener('change', (e) => {
  settings.autoFlip = e.target.checked;
  saveSettings('chess', settings);
  refresh();
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!$('btn-undo').disabled) undo(); }
  if (e.key === 'Escape') { clearSelection(); board.redraw(); }
});

refresh();
// Khôi phục ván đến lượt máy (ví dụ tải lại trang khi máy đang nghĩ).
maybeAIMove();
