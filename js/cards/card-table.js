// Bàn chơi bài bằng p5.js (instance mode): vẽ lá bài, kéo thả, chạm chọn và hoạt ảnh di chuyển.
// Không biết gì về luật chơi — chỉ nhận một "cảnh" (scene) mô tả vị trí đích của từng lá:
//   scene = { width, height, cardW, cardH,
//             slots: [{ pile, x, y, label?, suit? }],          ô trống / chỗ đặt bài
//             cards: [{ id, x, y, up, pile, index }],          theo thứ tự vẽ (dưới → trên)
//             zones: [{ pile, x, y, w, h }],                    vùng nhận thả / chạm của từng chồng
//             origin: { x, y } | null }                         nơi lá bài mới bay ra (chia bài)
// Mỗi lá bài được nhận diện bằng ID, nên khi trạng thái đổi, lá bài trượt từ vị trí cũ tới vị trí mới.
// Đổi kích thước màn hình chỉ tính lại cảnh (đặt ngay vào chỗ), không chạm tới trạng thái ván.
import { CANVAS_FONT } from '../common/p5board.js';
import { readThemeColors } from '../common/ui.js';
import { drawCard, drawSlot, CARD_COLOR_NAMES } from './card-render.js';

const MOVE_MS = 190;
const FLIP_MS = 220;
const DRAG_THRESHOLD = 6;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => 1 - (1 - t) ** 3;

/**
 * options:
 *   scene(availWidth, availHeight) → scene
 *   canDrag({ pile, index, id }) → boolean
 *   onTap(hit | null)              hit = { pile, index, id } (index = -1 khi chạm vào chồng trống / vùng chồng)
 *   onDrop({ pile, index }, toPile)  → gọi khi thả bài lên một chồng khác
 *   overlay(p, scene, colors, api)  vẽ thêm (chữ, tổng điểm…) phía trên bài
 *   reserveHeight, minHeight        chiều cao chừa ra bên dưới bàn / chiều cao tối thiểu
 */
export function createCardTable(container, options) {
  const { scene: computeScene, canDrag = () => false, onTap = () => {}, onDrop = () => {}, overlay = null, reserveHeight = 0, minHeight = 340 } = options;
  let p5ref = null;
  let ready = false;
  let scene = null;
  let colors = readThemeColors(CARD_COLOR_NAMES);
  const disp = new Map(); // id → { sx, sy, tx, ty, t0, dur, upFrom, up, ft0 }
  let drag = null;
  let press = null;
  let selected = null;     // { pile, index }
  let hint = null;         // { ids: Set, pile, until }
  let pendingRefresh = null;

  // Bàn vừa khít phần còn lại của màn hình bên dưới thanh công cụ (khi trang ở đầu).
  function avail() {
    const top = container.getBoundingClientRect().top + window.scrollY;
    return {
      w: Math.max(260, container.clientWidth),
      h: Math.max(minHeight, window.innerHeight - top - 10 - reserveHeight),
    };
  }

  function position(d, now) {
    if (!d.dur || now >= d.t0 + d.dur) return { x: d.tx, y: d.ty, moving: false };
    const t = Math.max(0, (now - d.t0) / d.dur);
    const e = ease(t);
    return { x: d.sx + (d.tx - d.sx) * e, y: d.sy + (d.ty - d.sy) * e, moving: true };
  }

  function faceState(d, now) {
    if (!d.ft0 || now >= d.ft0 + FLIP_MS) return { up: d.up, scaleX: 1, flipping: false };
    if (now < d.ft0) return { up: d.upFrom, scaleX: 1, flipping: true };
    const t = (now - d.ft0) / FLIP_MS;
    return { up: t < 0.5 ? d.upFrom : d.up, scaleX: Math.abs(Math.cos(Math.PI * t)), flipping: true };
  }

  /**
   * Tính lại cảnh từ trạng thái hiện tại. `instant`: đặt bài ngay (đổi kích thước); `deal`: chia lại từ đầu;
   * lá mới xuất hiện bay ra lần lượt sau `delay` ms, cách nhau `stagger` ms. Trả về thời gian hoạt ảnh (ms).
   */
  function refresh({ instant = false, deal = false, stagger = 0, delay = 0 } = {}) {
    if (!ready) { pendingRefresh = { instant, deal, stagger, delay }; return 0; }
    const size = avail();
    scene = computeScene(size.w, size.h);
    const w = Math.floor(scene.width), h = Math.floor(scene.height);
    if (p5ref.width !== w || p5ref.height !== h) p5ref.resizeCanvas(w, h, true);
    if (deal) disp.clear();
    const animate = !instant && !reduceMotion();
    const now = performance.now();
    const seen = new Set();
    let newCount = 0;
    let longest = 0;
    for (const c of scene.cards) {
      seen.add(c.id);
      let d = disp.get(c.id);
      if (!d) {
        if (animate && scene.origin) {
          const wait = delay + newCount++ * (stagger || 0);
          d = { sx: scene.origin.x, sy: scene.origin.y, tx: c.x, ty: c.y, t0: now + wait, dur: MOVE_MS + 60, upFrom: false, up: c.up, ft0: c.up ? now + wait + MOVE_MS * 0.5 : 0 };
          longest = Math.max(longest, wait + MOVE_MS + 60 + (c.up ? FLIP_MS : 0));
        } else {
          d = { sx: c.x, sy: c.y, tx: c.x, ty: c.y, t0: 0, dur: 0, upFrom: c.up, up: c.up, ft0: 0 };
        }
        disp.set(c.id, d);
        continue;
      }
      const cur = position(d, now);
      if (Math.abs(cur.x - c.x) > 0.5 || Math.abs(cur.y - c.y) > 0.5) {
        if (animate) {
          const dist = Math.hypot(cur.x - c.x, cur.y - c.y);
          Object.assign(d, { sx: cur.x, sy: cur.y, tx: c.x, ty: c.y, t0: now, dur: Math.min(340, MOVE_MS + dist * 0.12) });
          longest = Math.max(longest, d.dur);
        } else {
          Object.assign(d, { sx: c.x, sy: c.y, tx: c.x, ty: c.y, t0: 0, dur: 0 });
        }
      } else if (d.tx !== c.x || d.ty !== c.y) {
        Object.assign(d, { tx: c.x, ty: c.y });
      }
      if (d.up !== c.up) {
        d.upFrom = faceState(d, now).up;
        d.up = c.up;
        d.ft0 = animate ? Math.max(now, d.t0 + (d.dur || 0) * 0.4) : 0;
        if (animate) longest = Math.max(longest, d.ft0 - now + FLIP_MS);
      }
    }
    for (const id of [...disp.keys()]) if (!seen.has(id)) disp.delete(id);
    if (selected && !scene.cards.some((c) => c.pile === selected.pile && c.index === selected.index)) selected = null;
    p5ref.loop();
    return longest;
  }

  function isAnimating(now) {
    for (const d of disp.values()) {
      if (d.dur && now < d.t0 + d.dur) return true;
      if (d.ft0 && now < d.ft0 + FLIP_MS) return true;
    }
    return false;
  }

  /* ---------- Vẽ ---------- */

  function draw(p) {
    const now = performance.now();
    p.clear();
    if (!scene) return;
    const { cardW: cw, cardH: ch } = scene;
    p.noStroke();
    p.fill(colors.felt);
    p.rect(0, 0, p.width, p.height, 12);

    const hintActive = hint && now < hint.until;
    if (hint && !hintActive) hint = null;
    for (const s of scene.slots) {
      const empty = !scene.cards.some((c) => c.pile === s.pile);
      drawSlot(p, s.x, s.y, cw, ch, colors, { label: s.label, suit: s.suit, active: hintActive && hint.pile === s.pile && empty });
    }

    const dragIds = drag?.active ? new Set(drag.ids) : null;
    const topOfHintPile = hintActive ? lastCardOf(hint.pile) : null;
    const later = [];
    const paint = (c, pos, face, extra = {}) => {
      let highlight = null;
      if (selected && c.pile === selected.pile && c.index >= selected.index) highlight = 'select';
      if (hintActive && (hint.ids.has(c.id) || c.id === topOfHintPile)) highlight = 'hint';
      drawCard(p, c.id, pos.x, pos.y, cw, ch, colors, { up: face.up, scaleX: face.scaleX, highlight, sideIndex: !!c.sideIndex, ...extra });
    };
    for (const c of scene.cards) {
      if (dragIds?.has(c.id)) continue;
      const d = disp.get(c.id);
      const pos = position(d, now);
      const face = faceState(d, now);
      if (pos.moving || now < d.t0) later.push([c, pos, face]);
      else paint(c, pos, face);
    }
    // Lá đang bay được vẽ sau cùng để nằm trên các lá đứng yên.
    for (const [c, pos, face] of later) paint(c, pos, face, { shadow: true });
    if (dragIds) {
      for (const c of scene.cards) {
        if (!dragIds.has(c.id)) continue;
        drawCard(p, c.id, c.x + drag.dx, c.y + drag.dy, cw, ch, colors, { up: true, highlight: 'select', shadow: true });
      }
    }
    overlay?.(p, scene, colors, { isSettled: (id) => isSettled(id, now) });

    if (!drag?.active && !hintActive && !isAnimating(now)) p.noLoop();
  }

  function lastCardOf(pile) {
    let last = null;
    for (const c of scene.cards) if (c.pile === pile) last = c.id;
    return last;
  }

  function isSettled(id, now = performance.now()) {
    const d = disp.get(id);
    if (!d) return false;
    return !(d.dur && now < d.t0 + d.dur) && !(d.ft0 && now < d.ft0 + FLIP_MS);
  }

  /* ---------- Nhập liệu: chuột + cảm ứng qua Pointer Events ---------- */

  function hitTest(x, y) {
    if (!scene) return null;
    const { cardW: cw, cardH: ch } = scene;
    for (let i = scene.cards.length - 1; i >= 0; i--) {
      const c = scene.cards[i];
      if (x >= c.x && x <= c.x + cw && y >= c.y && y <= c.y + ch) return { pile: c.pile, index: c.index, id: c.id };
    }
    for (const z of scene.zones) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return { pile: z.pile, index: -1, id: null };
    }
    return null;
  }

  function dropTarget(from) {
    const { cardW: cw, cardH: ch } = scene;
    const lead = scene.cards.find((c) => c.id === drag.ids[0]);
    const rx = lead.x + drag.dx, ry = lead.y + drag.dy;
    const px = drag.px, py = drag.py;
    let best = null, bestArea = 0;
    for (const z of scene.zones) {
      if (z.pile === from) continue;
      if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) return z.pile;
      const ox = Math.min(rx + cw, z.x + z.w) - Math.max(rx, z.x);
      const oy = Math.min(ry + ch, z.y + z.h) - Math.max(ry, z.y);
      if (ox > 0 && oy > 0 && ox * oy > bestArea) { bestArea = ox * oy; best = z.pile; }
    }
    return best;
  }

  function bindPointer(elt) {
    const local = (e) => {
      const rect = elt.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * p5ref.width, y: ((e.clientY - rect.top) / rect.height) * p5ref.height };
    };
    elt.addEventListener('contextmenu', (e) => e.preventDefault());
    elt.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (press) return;
      const pt = local(e);
      const hit = hitTest(pt.x, pt.y);
      press = { id: e.pointerId, x: pt.x, y: pt.y, hit, draggable: !!(hit && hit.index >= 0 && canDrag(hit)) };
      try { elt.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      e.preventDefault();
    });
    elt.addEventListener('pointermove', (e) => {
      if (!press || e.pointerId !== press.id) return;
      const pt = local(e);
      if (!drag && press.draggable && Math.hypot(pt.x - press.x, pt.y - press.y) > DRAG_THRESHOLD) {
        const { pile, index } = press.hit;
        const ids = scene.cards.filter((c) => c.pile === pile && c.index >= index).map((c) => c.id);
        drag = { active: true, pile, index, ids, dx: 0, dy: 0, px: pt.x, py: pt.y };
        selected = null;
        p5ref.loop();
      }
      if (drag) {
        drag.dx = pt.x - press.x;
        drag.dy = pt.y - press.y;
        drag.px = pt.x;
        drag.py = pt.y;
      }
    });
    const finish = (e, cancelled) => {
      if (!press || e.pointerId !== press.id) return;
      const hit = press.hit;
      press = null;
      if (drag) {
        const d = drag;
        const to = cancelled ? null : dropTarget(d.pile);
        // Lá bài bắt đầu trượt từ chỗ được thả (tới đích mới, hoặc quay về chỗ cũ).
        for (const c of scene.cards) {
          if (!d.ids.includes(c.id)) continue;
          const x = c.x + d.dx, y = c.y + d.dy;
          Object.assign(disp.get(c.id), { sx: x, sy: y, tx: x, ty: y, t0: 0, dur: 0 });
        }
        drag = null;
        if (to) onDrop({ pile: d.pile, index: d.index }, to);
        refresh();
        return;
      }
      if (!cancelled) onTap(hit);
    };
    elt.addEventListener('pointerup', (e) => finish(e, false));
    elt.addEventListener('pointercancel', (e) => finish(e, true));
  }

  const sketch = (p) => {
    p.setup = () => {
      const canvas = p.createCanvas(10, 10);
      canvas.elt.classList.add('board-canvas', 'card-canvas');
      canvas.elt.setAttribute('role', 'application');
      p.textFont(CANVAS_FONT);
      p.noLoop();
      bindPointer(canvas.elt);
      ready = true;
      refresh(pendingRefresh || { instant: true });
      pendingRefresh = null;
    };
    p.draw = () => draw(p);
  };
  p5ref = new window.p5(sketch, container);

  let lastW = container.clientWidth;
  const onResize = () => { if (ready && !drag) refresh({ instant: true }); };
  new ResizeObserver(() => {
    if (container.clientWidth !== lastW) { lastW = container.clientWidth; onResize(); }
  }).observe(container);
  window.addEventListener('resize', onResize);
  window.addEventListener('themechange', () => {
    colors = readThemeColors(CARD_COLOR_NAMES);
    if (ready) p5ref.redraw();
  });

  return {
    refresh,
    redraw: () => { if (ready) p5ref.loop(); },
    get scene() { return scene; },
    get selected() { return selected; },
    select(sel) { selected = sel; if (ready) p5ref.loop(); },
    showHint(ids, pile, ms = 1700) {
      hint = { ids: new Set(ids), pile, until: performance.now() + ms };
      if (ready) p5ref.loop();
    },
    clearHint() { hint = null; },
  };
}
