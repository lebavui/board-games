// Điều khiển trang chung cho các game bài một người (Klondike, FreeCell, Spider):
// bàn p5, kéo thả / chạm chọn, hoàn tác, gợi ý, ván mới, chơi lại cùng thứ tự chia, lưu tiến trình.
import { initPage, confirmDialog, resultDialog, formatTime, bindActions, toast } from '../common/ui.js';
import { load, save, loadSettings, saveSettings } from '../common/storage.js';
import { Stopwatch } from '../common/stopwatch.js';
import { randomSeed } from './deck.js';
import { createSession, commit, undo, canUndo, restart, serializeSession, restoreSession } from './session.js';
import { createCardTable } from './card-table.js';

const SAVE_VERSION = 1;

/**
 * config:
 *   id, rules (module luật), scene(state, w, h)
 *   defaultOptions, optionKey ('draw' | 'suits' …), optionLabel(options) → chuỗi mô tả chế độ
 *   tapPile?(state, pile) → state mới | chuỗi lỗi | null    (chạm chồng bài rút / chia bài)
 *   postMove?(state, settings) → state                      (ví dụ FreeCell tự đưa bài an toàn lên đích)
 *   finisher?: { can(state), next(state) }                  (tự hoàn tất)
 *   onChange?(state)                                        cập nhật phần HTML riêng của từng game
 *   extraSettings: { tên: giá trị mặc định }                (cài đặt không ảnh hưởng tới chia bài)
 */
export function initSolitairePage(config) {
  const { id, rules, scene, defaultOptions, optionKey, optionLabel, tapPile, postMove, finisher, onChange, extraSettings = {} } = config;
  initPage(id);
  const $ = (x) => document.getElementById(x);
  const SAVE_KEY = `${id}:game`;
  const STATS_KEY = `${id}:stats`;

  const settings = loadSettings(id, { options: defaultOptions, ...extraSettings });
  settings.options = rules.normalizeOptions(settings.options);
  let stats = load(STATS_KEY) || {};
  let session = null;
  let won = false;
  let finishing = null;
  const stopwatch = new Stopwatch((s) => { $('timer').textContent = formatTime(s); });

  function restore() {
    const data = load(SAVE_KEY, { version: SAVE_VERSION });
    const s = restoreSession(rules, data);
    if (!s) return false;
    session = s;
    won = rules.isWon(s.state);
    stopwatch.reset(data.elapsed || 0);
    return true;
  }

  function persist() {
    if (!session) return;
    save(SAVE_KEY, { ...serializeSession(session), elapsed: stopwatch.seconds }, SAVE_VERSION);
  }

  const hasProgress = () => session && session.state.moves > 0 && !won;
  const state = () => session.state;

  /* ---------- Bàn chơi ---------- */

  const table = createCardTable($('board'), {
    scene: (w, h) => (session ? scene(state(), w, h) : { width: w, height: h, cardW: 1, cardH: 1, slots: [], cards: [], zones: [] }),
    canDrag: (hit) => !won && !finishing && rules.canPick(state(), hit.pile, hit.index),
    onDrop: (from, to) => {
      if (!attempt({ from: from.pile, index: from.index, to })) toast('Không thể đặt bài vào đó', { duration: 1400 });
    },
    onTap: handleTap,
  });

  function handleTap(hit) {
    if (won || finishing) return;
    const sel = table.selected;
    if (hit && tapPile && hit.pile === 'stock') {
      table.select(null);
      const result = tapPile(state());
      if (typeof result === 'string') toast(result, { tone: 'bad' });
      else if (result) apply(result);
      return;
    }
    if (!hit) { table.select(null); return; }
    const pickable = hit.index >= 0 && rules.canPick(state(), hit.pile, hit.index);
    if (sel) {
      if (hit.pile === sel.pile) {
        if (hit.index === sel.index || hit.index === -1) {
          // Chạm lần nữa vào lá đang chọn: tự chuyển tới chỗ phù hợp (đích trước).
          const to = rules.autoTarget(state(), sel.pile, sel.index);
          table.select(null);
          if (to) attempt({ from: sel.pile, index: sel.index, to });
          else toast('Chưa có chỗ đặt lá này', { duration: 1400 });
        } else {
          table.select(pickable ? { pile: hit.pile, index: hit.index } : null);
        }
        return;
      }
      if (attempt({ from: sel.pile, index: sel.index, to: hit.pile })) return;
      if (pickable) { table.select({ pile: hit.pile, index: hit.index }); return; }
      table.select(null);
      toast('Nước đi không hợp lệ', { duration: 1400 });
      return;
    }
    if (pickable) table.select({ pile: hit.pile, index: hit.index });
  }

  function attempt(move) {
    const next = rules.tryMove(state(), move);
    if (!next) return false;
    table.select(null);
    apply(next);
    return true;
  }

  function apply(next) {
    const final = postMove ? postMove(next, settings) : next;
    commit(session, final);
    if (!stopwatch.running && !won) stopwatch.start();
    table.clearHint();
    afterChange();
  }

  function afterChange({ deal = false } = {}) {
    const wait = table.refresh({ deal, stagger: deal ? Math.max(6, 900 / rules.expectedIds(session.options).length) : 0 });
    if (!won && rules.isWon(state())) {
      won = true;
      stopwatch.stop();
      recordWin();
      setTimeout(showWin, wait + 150);
    }
    persist();
    refreshUI();
  }

  function recordWin() {
    const key = optionLabel(session.options);
    const s = stats[key] || { wins: 0, best: null, bestMoves: null };
    s.wins++;
    const t = stopwatch.seconds;
    if (s.best == null || t < s.best) s.best = t;
    if (s.bestMoves == null || state().moves < s.bestMoves) s.bestMoves = state().moves;
    stats[key] = s;
    save(STATS_KEY, stats);
  }

  function showWin() {
    const s = stats[optionLabel(session.options)];
    resultDialog('Bạn đã thắng!', `${optionLabel(session.options)} · Ván #${session.seed}\nThời gian ${formatTime(stopwatch.seconds)} · ${state().moves} nước đi\nĐã thắng ${s.wins} ván ở chế độ này · nhanh nhất ${formatTime(s.best)}`, 'win', { viewLabel: 'Xem bàn bài' })
      .then((v) => { if (v === 'again') newGame(); });
  }

  /* ---------- Giao diện HTML ---------- */

  function refreshUI() {
    $('chip-game').textContent = `Ván #${session.seed}`;
    $('moves').textContent = String(state().moves);
    const chip = $('chip-state');
    chip.className = won ? 'chip ok' : 'chip';
    chip.textContent = won ? 'Đã thắng' : optionLabel(session.options);
    $('btn-undo').disabled = won || !!finishing || !canUndo(session);
    $('btn-hint').disabled = won || !!finishing;
    const finishBtn = $('btn-finish');
    if (finishBtn) finishBtn.hidden = !(finisher && !won && finisher.can(state()));
    document.querySelectorAll('#options button').forEach((b) => {
      b.setAttribute('aria-pressed', String(String(settings.options[optionKey]) === b.dataset.value));
    });
    const s = stats[optionLabel(settings.options)];
    $('stats').textContent = s ? `Chế độ ${optionLabel(settings.options)}: đã thắng ${s.wins} ván · nhanh nhất ${formatTime(s.best)} · ít nước nhất ${s.bestMoves}.` : `Chế độ ${optionLabel(settings.options)}: chưa có ván thắng.`;
    if (optionLabel(settings.options) !== optionLabel(session.options)) $('stats').textContent += ' Chế độ mới áp dụng từ ván sau.';
    onChange?.(state());
  }

  function newGame() {
    stopFinishing();
    session = createSession(rules, randomSeed(), settings.options);
    won = false;
    stopwatch.reset(0);
    table.select(null);
    table.clearHint();
    afterChange({ deal: true });
  }

  async function requestNewGame() {
    if (hasProgress() && !(await confirmDialog('Bắt đầu ván mới?', 'Ván đang chơi sẽ bị bỏ.', { confirmLabel: 'Ván mới', danger: true }))) return;
    newGame();
  }

  async function requestRestart() {
    if (hasProgress() && !(await confirmDialog('Chơi lại ván này?', 'Bài được chia lại đúng như lúc đầu ván; các nước đã đi sẽ bị xóa.', { confirmLabel: 'Chơi lại', danger: true }))) return;
    stopFinishing();
    restart(rules, session);
    won = false;
    stopwatch.reset(0);
    table.select(null);
    afterChange({ deal: true });
  }

  function doUndo() {
    if (won || finishing || !undo(session)) return;
    table.select(null);
    table.clearHint();
    afterChange();
  }

  function doHint() {
    if (won || finishing) return;
    const h = rules.hint(state());
    if (!h) {
      toast('Không tìm thấy nước đi có ích — hãy thử hoàn tác hoặc chơi ván mới.', { duration: 3200 });
      return;
    }
    table.select(null);
    if (h.move.from) table.showHint(state().piles[h.move.from].slice(h.move.index), h.move.to);
    else table.showHint([], 'stock');
    toast(`Gợi ý: ${h.text}`, { duration: 2600 });
  }

  function stopFinishing() {
    if (finishing) clearTimeout(finishing);
    finishing = null;
  }

  function autoFinish() {
    if (!finisher || won || finishing || !finisher.can(state())) return;
    table.select(null);
    const step = () => {
      const move = finisher.next(state());
      const next = move && rules.tryMove(state(), move);
      if (!next) { finishing = null; refreshUI(); return; }
      commit(session, next);
      finishing = setTimeout(step, 90);
      afterChange();
      if (won) finishing = null;
    };
    finishing = setTimeout(step, 0);
    refreshUI();
  }

  async function setOption(value) {
    const options = rules.normalizeOptions({ ...settings.options, [optionKey]: Number.isNaN(Number(value)) ? value : Number(value) });
    settings.options = options;
    saveSettings(id, settings);
    if (optionLabel(options) === optionLabel(session.options)) { refreshUI(); return; }
    if (!hasProgress()) { newGame(); return; }
    refreshUI();
    if (await confirmDialog('Đổi chế độ?', `Chế độ “${optionLabel(options)}” áp dụng khi chia ván mới. Bắt đầu ván mới ngay bây giờ?`, { confirmLabel: 'Ván mới', cancelLabel: 'Để sau' })) newGame();
  }

  bindActions(document.querySelector('.game-layout'), {
    'new-game': requestNewGame,
    restart: requestRestart,
    undo: doUndo,
    hint: doHint,
    finish: autoFinish,
    option: (btn) => setOption(btn.dataset.value),
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); doUndo(); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (k === 'u') doUndo();
      else if (k === 'h') doHint();
      else if (k === 'escape') table.select(null);
    }
  });
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  if (restore()) {
    if (!won && state().moves > 0) stopwatch.start();
    table.refresh({ instant: true });
    refreshUI();
  } else {
    newGame();
  }

  return { get session() { return session; }, settings, refreshUI };
}
