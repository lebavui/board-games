// Đồng hồ bấm giờ: chỉ chạy khi tab đang hiển thị, lưu được số giây đã trôi qua.
export class Stopwatch {
  constructor(onTick) {
    this.onTick = onTick;
    this.elapsedMs = 0;
    this.running = false;
    this.lastStamp = 0;
    this.timer = null;
    document.addEventListener('visibilitychange', () => {
      if (!this.running) return;
      if (document.hidden) this.accumulate();
      else this.lastStamp = performance.now();
    });
  }

  accumulate() {
    const now = performance.now();
    if (this.running && !document.hidden) this.elapsedMs += now - this.lastStamp;
    this.lastStamp = now;
  }

  get seconds() {
    if (this.running) this.accumulate();
    return Math.floor(this.elapsedMs / 1000);
  }

  set seconds(value) {
    this.elapsedMs = (value || 0) * 1000;
    this.lastStamp = performance.now();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastStamp = performance.now();
    this.timer = setInterval(() => this.onTick?.(this.seconds), 500);
    this.onTick?.(this.seconds);
  }

  stop() {
    if (!this.running) return;
    this.accumulate();
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.onTick?.(this.seconds);
  }

  reset(seconds = 0) {
    this.stop();
    this.seconds = seconds;
    this.onTick?.(this.seconds);
  }
}
