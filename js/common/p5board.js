// Bộ khung p5.js (instance mode) dùng chung cho mọi bàn chơi.
// - Tự điều chỉnh kích thước canvas theo vùng chứa mà không động tới trạng thái ván chơi.
// - Gộp chuột và cảm ứng bằng Pointer Events: chạm/nhấp, chuột phải và nhấn giữ.
// - Chỉ vẽ lại khi cần (noLoop + redraw) để tiết kiệm pin trên điện thoại.

// p5 bọc tên font có khoảng trắng trong dấu ngoặc kép, làm hỏng cả chuỗi font dự phòng.
// Vì vậy khoảng trắng trong tên font được viết bằng mã thoát CSS \000020 (viết "\\000020" trong chuỗi JS).
export const CANVAS_FONT = 'Be\\000020Vietnam\\000020Pro,system-ui,-apple-system,Segoe\\000020UI,Roboto,sans-serif';

const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE = 10;

/**
 * @param {HTMLElement} container phần tử chứa canvas
 * @param {object} options
 *   layout(availWidth, availHeight) => { width, height }  kích thước canvas mong muốn
 *   draw(p, width, height)                                 vẽ toàn bộ bàn
 *   onPress({ x, y, button: 'left'|'right', pointerType, long })
 *   longPress: boolean                                     bật nhấn giữ (cảm ứng) => long: true
 *   reserveHeight: number                                  chiều cao dành cho thanh trạng thái quanh bàn
 */
export function createBoard(container, options) {
  const { layout, draw, onPress, onReady, longPress = false, reserveHeight = 0 } = options;
  let size = { width: 10, height: 10 };
  let p5ref = null;
  let ready = false;

  function measure() {
    const availWidth = Math.max(200, container.clientWidth);
    const header = document.querySelector('.site-header');
    const headerH = header ? header.offsetHeight : 0;
    const availHeight = Math.max(300, window.innerHeight - headerH - 32 - reserveHeight);
    const next = layout(availWidth, availHeight);
    return { width: Math.floor(next.width), height: Math.floor(next.height) };
  }

  const sketch = (p) => {
    p.setup = () => {
      size = measure();
      const canvas = p.createCanvas(size.width, size.height);
      canvas.elt.classList.add('board-canvas');
      canvas.elt.setAttribute('role', 'application');
      p.textFont(CANVAS_FONT);
      p.noLoop();
      bindPointer(canvas.elt);
      ready = true;
      onReady?.();
    };
    p.draw = () => {
      p.clear();
      draw(p, size.width, size.height);
    };
  };

  function bindPointer(elt) {
    let pending = null;

    const local = (e) => {
      const rect = elt.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * size.width,
        y: ((e.clientY - rect.top) / rect.height) * size.height,
      };
    };
    const clearPending = () => {
      if (pending?.timer) clearTimeout(pending.timer);
      pending = null;
    };

    elt.addEventListener('contextmenu', (e) => e.preventDefault());

    elt.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        onPress({ ...local(e), button: e.button === 2 ? 'right' : 'left', pointerType: 'mouse', long: false });
        return;
      }
      // Cảm ứng / bút: chờ nhả tay để phân biệt chạm, nhấn giữ và cuộn trang.
      clearPending();
      const pt = local(e);
      pending = { id: e.pointerId, x: e.clientX, y: e.clientY, pt, fired: false, timer: null };
      if (longPress) {
        const current = pending;
        current.timer = setTimeout(() => {
          if (pending !== current) return;
          current.fired = true;
          if (navigator.vibrate) navigator.vibrate(15);
          onPress({ ...current.pt, button: 'left', pointerType: e.pointerType, long: true });
        }, LONG_PRESS_MS);
      }
    });

    elt.addEventListener('pointermove', (e) => {
      if (!pending || e.pointerId !== pending.id) return;
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > MOVE_TOLERANCE) clearPending();
    });

    elt.addEventListener('pointerup', (e) => {
      if (!pending || e.pointerId !== pending.id) return;
      const { fired, pt } = pending;
      clearPending();
      if (!fired) {
        e.preventDefault();
        onPress({ ...pt, button: 'left', pointerType: e.pointerType, long: false });
      }
    });

    elt.addEventListener('pointercancel', clearPending);
    elt.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') clearPending(); });
  }

  function resize() {
    if (!p5ref || !ready) return;
    const next = measure();
    if (next.width === size.width && next.height === size.height) return;
    size = next;
    p5ref.resizeCanvas(size.width, size.height, true);
    p5ref.redraw();
  }

  p5ref = new window.p5(sketch, container);

  let lastWidth = container.clientWidth;
  const observer = new ResizeObserver(() => {
    if (container.clientWidth !== lastWidth) {
      lastWidth = container.clientWidth;
      resize();
    }
  });
  observer.observe(container);
  window.addEventListener('resize', resize);
  window.addEventListener('themechange', () => { if (ready) p5ref.redraw(); });

  return {
    redraw: () => { if (ready) p5ref.redraw(); },
    get ready() { return ready; },
    /** Gọi khi kích thước logic của bàn thay đổi (ví dụ đổi cấp độ Dò mìn). */
    relayout: () => { size = { width: 0, height: 0 }; resize(); },
    get size() { return size; },
    get p() { return p5ref; },
  };
}
