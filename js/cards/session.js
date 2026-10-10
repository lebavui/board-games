// Phiên chơi bài một người (Klondike, FreeCell, Spider): lịch sử hoàn tác, chơi lại, lưu/tải.
// Thuần dữ liệu — dùng chung cho mọi luật chơi có giao diện `rules` sau:
//   rules.newGame(seed, options) → state     (state có seed, options, piles, up, moves)
//   rules.normalizeOptions(options) → options hợp lệ
//   rules.expectedIds(options) → danh sách ID lá bài của ván
import { verifyPiles, cloneState } from './deck.js';

export const HISTORY_LIMIT = 400;

export function createSession(rules, seed, options) {
  const opts = rules.normalizeOptions(options);
  return { seed, options: opts, state: rules.newGame(seed, opts), history: [] };
}

/** Ghi nhận trạng thái mới (đã được luật chơi kiểm tra) và lưu trạng thái cũ để hoàn tác. */
export function commit(session, nextState) {
  session.history.push(session.state);
  if (session.history.length > HISTORY_LIMIT) session.history.shift();
  session.state = nextState;
}

export function canUndo(session) {
  return session.history.length > 0;
}

export function undo(session) {
  if (!session.history.length) return false;
  session.state = session.history.pop();
  return true;
}

/** Chơi lại ván hiện tại: cùng seed và tùy chọn nên thứ tự chia bài giữ nguyên. */
export function restart(rules, session) {
  session.state = rules.newGame(session.seed, session.options);
  session.history = [];
}

export function serializeSession(session) {
  return cloneState({ seed: session.seed, options: session.options, state: session.state, history: session.history });
}

function validState(rules, state, options) {
  return state && typeof state === 'object' && state.piles && state.up && typeof state.up === 'object'
    && verifyPiles(state.piles, rules.expectedIds(options));
}

/** Tải phiên đã lưu; trả về null nếu dữ liệu hỏng (thiếu/thừa/trùng lá bài). */
export function restoreSession(rules, data) {
  if (!data || typeof data !== 'object' || !Number.isInteger(data.seed)) return null;
  const options = rules.normalizeOptions(data.options);
  if (JSON.stringify(options) !== JSON.stringify(data.options)) return null;
  if (!validState(rules, data.state, options)) return null;
  const history = Array.isArray(data.history) ? data.history.filter((s) => validState(rules, s, options)) : [];
  if (history.length !== (data.history || []).length) return null;
  return cloneState({ seed: data.seed, options, state: data.state, history });
}
