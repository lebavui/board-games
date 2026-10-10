// Điều phối ván Bắn tàu: nhận phát bắn của người chơi, lên lịch đúng MỘT lượt bắn của máy,
// lưu sau mỗi thay đổi và hủy tác vụ máy của ván cũ khi bắt đầu ván mới.
// Không phụ thuộc DOM/p5 — bộ hẹn giờ được truyền vào để kiểm thử bằng Node.
import { fire, observe } from './logic.js';
import { chooseShot } from './bot.js';

/**
 * Lượt của máy: máy chỉ thấy observe(state, 'player') — không bao giờ thấy state.fleets.player.
 * Trả về kết quả fire() kèm trạng thái RNG mới của máy, hoặc { ok: false } nếu không phải lượt máy.
 */
export function botTurn(state) {
  if (state.phase !== 'bot') return { ok: false, error: 'turn' };
  const choice = chooseShot(observe(state, 'player'), state.level, state.botRng);
  const res = fire(state, 'bot', choice.cell);
  if (!res.ok) return res;
  return { ...res, state: { ...res.state, botRng: choice.rng } };
}

/**
 * options:
 *   persist(state)          lưu trạng thái (gọi sau mỗi thay đổi)
 *   onChange(state, events) cập nhật giao diện; events: các phát bắn vừa xảy ra
 *   botDelay(event)         thời gian chờ (ms) trước khi máy bắn — để hiệu ứng phát trước chạy xong
 *   timer: { set(fn, ms), clear(handle) }
 */
export function createMatch(initial, { persist = () => {}, onChange = () => {}, botDelay = () => 800, timer } = {}) {
  const clock = timer || { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) };
  let state = initial;
  let token = 0; // tăng mỗi khi thay ván: tác vụ máy mang token cũ sẽ bị bỏ qua
  let pending = null;

  function commit(next, events = []) {
    state = next;
    persist(state);
    onChange(state, events);
    scheduleBot(events[events.length - 1]);
  }

  function cancelBot() {
    if (pending) clock.clear(pending.handle);
    pending = null;
  }

  /** Lên lịch lượt máy nếu đang tới lượt máy và chưa có tác vụ nào chờ. */
  function scheduleBot(lastEvent) {
    if (state.phase !== 'bot' || pending) return;
    const task = { token };
    task.handle = clock.set(() => runBot(task), botDelay(lastEvent));
    pending = task;
  }

  function runBot(task) {
    if (pending === task) pending = null;
    // Tác vụ của ván cũ, hoặc lượt máy đã được xử lý: bỏ qua, không bắn lặp.
    if (task.token !== token || state.phase !== 'bot') return;
    const res = botTurn(state);
    if (res.ok) commit(res.state, [res.event]);
  }

  return {
    get state() { return state; },
    get botPending() { return !!pending; },
    /** Người chơi bắn; trả về event hoặc null nếu bị từ chối (sai lượt, bắn lặp, ván đã xong). */
    playerFire(cell) {
      const res = fire(state, 'player', cell);
      if (!res.ok) return null;
      commit(res.state, [res.event]);
      return res.event;
    },
    /** Thay đổi trong giai đoạn đặt tàu hoặc bắt đầu trận (cùng ván). */
    update(next) {
      if (next) commit(next);
    },
    /** Ván mới: hủy mọi tác vụ máy của ván cũ trước khi nhận trạng thái mới. */
    replace(next) {
      cancelBot();
      token++;
      commit(next);
    },
    /** Sau khi tải lại trang: nếu đang là lượt máy thì tiếp tục đúng một lượt. */
    resume() {
      scheduleBot(null);
    },
    dispose() {
      cancelBot();
      token++;
    },
  };
}
