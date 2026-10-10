// Gọi đối thủ máy trong Web Worker; có thể hủy lượt tính đang chạy (khi hoàn tác hoặc ván mới).
// Nếu trình duyệt không hỗ trợ module worker thì tính ngay trên luồng chính.
const FALLBACK = {
  chess: () => import('../games/chess/ai.js'),
  checkers: () => import('../games/checkers/ai.js'),
  gomoku: () => import('../games/gomoku/ai.js'),
};

export class AIPlayer {
  constructor(game) {
    this.game = game;
    this.worker = null;
    this.workerFailed = false;
    this.seq = 0;
    this.pending = null; // { id, resolve }
  }

  ensureWorker() {
    if (this.worker || this.workerFailed) return;
    try {
      this.worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', (e) => {
        const { id, move, error } = e.data;
        if (!this.pending || this.pending.id !== id) return;
        const { resolve } = this.pending;
        this.pending = null;
        if (error) { console.error('Lỗi đối thủ máy:', error); resolve(null); } else resolve(move);
      });
      this.worker.addEventListener('error', (e) => {
        console.error('Không chạy được worker, chuyển sang luồng chính:', e.message);
        this.workerFailed = true;
        this.worker = null;
      });
    } catch {
      this.workerFailed = true;
    }
  }

  /** Trả về nước đi của máy, hoặc null nếu bị hủy. Chờ tối thiểu `minDelay` ms để nước đi không quá đột ngột. */
  async think(args, { minDelay = 400 } = {}) {
    this.cancel();
    const id = ++this.seq;
    const started = Date.now();
    this.ensureWorker();
    let move;
    if (this.worker) {
      move = await new Promise((resolve) => {
        this.pending = { id, resolve };
        this.worker.postMessage({ id, game: this.game, args });
      });
    } else {
      await new Promise((r) => setTimeout(r, 30)); // để giao diện kịp hiển thị "Máy đang nghĩ…"
      if (id !== this.seq) return null;
      const mod = await FALLBACK[this.game]();
      move = mod.chooseMove(...args);
    }
    if (id !== this.seq) return null;
    const wait = minDelay - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    return id === this.seq ? move : null;
  }

  /** Hủy lượt tính đang chạy (dừng hẳn worker để không tốn CPU). */
  cancel() {
    this.seq++;
    if (this.pending) {
      this.pending.resolve(null);
      this.pending = null;
      this.worker?.terminate();
      this.worker = null;
    }
  }
}
