// Vẽ bàn Bắn tàu bằng p5.js (instance mode) — mỗi bàn 10×10 là một canvas riêng.
// Chỉ đọc dữ liệu hiển thị do main.js chuẩn bị; không chứa luật chơi.
// Trạng thái ô phân biệt bằng HÌNH DẠNG, không chỉ màu: trượt = chấm tròn, trúng = dấu ✕,
// tàu chìm = thân tàu sẫm có gạch chéo + ✕, ô chưa bắn = nước trống.
import { SIZE, COLS } from './logic.js';
import { CANVAS_FONT } from '../../common/p5board.js';
import { readThemeColors } from '../../common/ui.js';

export const SEA_COLOR_NAMES = [
  'sea', 'sea-2', 'sea-line', 'sea-label', 'ship', 'ship-edge', 'ship-deck',
  'hit', 'hit-mark', 'miss', 'sunk', 'sunk-edge', 'aim', 'preview-ok', 'preview-bad',
];

const TAP_TOLERANCE = 10;

/** Hình học bàn: dải nhãn A–J / 1–10 ở trên và bên trái. */
export function geometry(side) {
  const band = Math.round(Math.max(16, side * 0.07));
  const cell = (side - band - 2) / SIZE;
  return { side, band, cell, ox: band, oy: band };
}

/**
 * Tạo một bàn p5. options:
 *   draw(p, geo, colors, now)      vẽ nội dung
 *   onPointer({ type, r, c, cell, inside, pointerType, tap })
 *       type: 'down' | 'move' | 'up' | 'leave' | 'cancel'; r/c có thể nằm ngoài bàn (khi kéo)
 *   sizeLimit()                    cạnh tối đa (px) theo chiều cao màn hình
 */
export function createSeaBoard(container, { draw, onPointer, sizeLimit = () => 520 }) {
  let geo = geometry(300);
  let p5ref = null;
  let ready = false;
  let animUntil = 0;
  let colors = null;

  const measure = () => {
    const width = Math.max(220, container.clientWidth);
    return Math.floor(Math.max(220, Math.min(width, sizeLimit())));
  };

  const sketch = (p) => {
    p.setup = () => {
      geo = geometry(measure());
      const canvas = p.createCanvas(geo.side, geo.side);
      canvas.elt.classList.add('board-canvas', 'sea-canvas');
      p.textFont(CANVAS_FONT);
      p.noLoop();
      bind(canvas.elt);
      ready = true;
      p.redraw();
    };
    p.draw = () => {
      colors ||= readThemeColors(SEA_COLOR_NAMES);
      const now = performance.now();
      p.clear();
      draw(p, geo, colors, now);
      if (now >= animUntil) p.noLoop();
    };
  };

  function bind(elt) {
    let down = null;
    const local = (e) => {
      const rect = elt.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * geo.side;
      const y = ((e.clientY - rect.top) / rect.height) * geo.side;
      const r = Math.floor((y - geo.oy) / geo.cell);
      const c = Math.floor((x - geo.ox) / geo.cell);
      const inside = r >= 0 && c >= 0 && r < SIZE && c < SIZE;
      return { r, c, inside, cell: inside ? r * SIZE + c : -1 };
    };
    const emit = (type, e, extra = {}) => onPointer({ type, pointerType: e.pointerType, ...local(e), ...extra });

    elt.addEventListener('contextmenu', (e) => e.preventDefault());
    elt.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      if (e.pointerType === 'mouse') e.preventDefault();
      // Giữ con trỏ khi kéo tàu ra khỏi mép canvas.
      try { elt.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
      emit('down', e);
    });
    elt.addEventListener('pointermove', (e) => {
      if (down && e.pointerId === down.id) {
        if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_TOLERANCE) down.moved = true;
        emit('move', e, { dragging: true, moved: down.moved });
        return;
      }
      if (e.pointerType === 'mouse') emit('move', e, { dragging: false });
    });
    elt.addEventListener('pointerup', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const tap = !down.moved;
      down = null;
      emit('up', e, { tap });
    });
    elt.addEventListener('pointercancel', (e) => {
      down = null;
      emit('cancel', e);
    });
    elt.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !down) emit('leave', e);
    });
  }

  function resize() {
    if (!ready) return;
    const side = measure();
    if (side === geo.side) return;
    geo = geometry(side);
    p5ref.resizeCanvas(side, side, true);
    p5ref.redraw();
  }

  p5ref = new window.p5(sketch, container);
  let lastWidth = container.clientWidth;
  new ResizeObserver(() => {
    if (container.clientWidth !== lastWidth) {
      lastWidth = container.clientWidth;
      resize();
    }
  }).observe(container);
  window.addEventListener('resize', resize);
  window.addEventListener('themechange', () => { colors = null; if (ready) p5ref.redraw(); });

  return {
    redraw() { if (ready) p5ref.redraw(); },
    /** Chạy vòng vẽ liên tục trong `ms` mili giây (hiệu ứng), rồi tự dừng. */
    animate(ms) {
      animUntil = Math.max(animUntil, performance.now() + ms);
      if (ready) p5ref.loop();
    },
    resize,
    get canvas() { return p5ref?.canvas || null; },
    get geo() { return geo; },
  };
}

/* ---------- Vẽ ---------- */

const EFFECT_MS = { miss: 650, hit: 700, sunk: 1100 };
export const effectDuration = (kind) => EFFECT_MS[kind] || 600;

function cellRect(geo, r, c) {
  return { x: geo.ox + c * geo.cell, y: geo.oy + r * geo.cell, s: geo.cell };
}

function center(geo, r, c) {
  return { x: geo.ox + (c + 0.5) * geo.cell, y: geo.oy + (r + 0.5) * geo.cell };
}

/**
 * view:
 *   marks: mảng 100 ô null | 'miss' | 'hit' | 'sunk'
 *   ships: [{ cells: [{ r, c }], dir, style }] — style: 'own' | 'sunk' | 'reveal' | 'ghost-ok' | 'ghost-bad' | 'origin' | 'held'
 *   hover: ô đang trỏ (-1 nếu không), aim: hiện tâm ngắm, last: phát bắn gần nhất trên bàn này
 *   effects: [{ kind, cells: [{ r, c }], t0 }]
 *   veil: { title, sub } phủ mờ bàn (giai đoạn đặt tàu ở bàn đối phương) hoặc null
 *   dim: làm mờ (không phải lượt bắn)
 */
export function drawSea(p, geo, colors, view, now) {
  const { band, cell, ox, oy } = geo;
  const W = cell * SIZE;
  const ctx = p.drawingContext;

  // Nhãn cột A–J và hàng 1–10.
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(Math.max(10, Math.min(15, band * 0.56, cell * 0.42)));
  const hr = view.hover >= 0 ? Math.floor(view.hover / SIZE) : -1;
  const hc = view.hover >= 0 ? view.hover % SIZE : -1;
  for (let k = 0; k < SIZE; k++) {
    p.fill(k === hc && view.aim ? colors.aim : colors['sea-label']);
    p.text(COLS[k], ox + (k + 0.5) * cell, band * 0.5);
    p.fill(k === hr && view.aim ? colors.aim : colors['sea-label']);
    p.text(String(k + 1), band * 0.48, oy + (k + 0.5) * cell);
  }
  p.textStyle(p.NORMAL);

  // Nước: ô xen kẽ rất nhẹ để dễ dò hàng/cột.
  p.push();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ox, oy, W, W, 6);
  ctx.clip();
  p.fill(colors.sea);
  p.rect(ox, oy, W, W);
  p.fill(colors['sea-2']);
  for (let r = 0; r < SIZE; r++) for (let c = (r % 2); c < SIZE; c += 2) {
    const q = cellRect(geo, r, c);
    p.rect(q.x, q.y, q.s, q.s);
  }

  // Tâm ngắm: tô hàng và cột của ô đang trỏ.
  if (view.aim && view.hover >= 0) {
    p.fill(colors.aim);
    ctx.globalAlpha = 0.14;
    p.rect(ox, oy + hr * cell, W, cell);
    p.rect(ox + hc * cell, oy, cell, W);
    ctx.globalAlpha = 1;
  }

  // Lưới.
  p.stroke(colors['sea-line']);
  p.strokeWeight(1);
  for (let k = 1; k < SIZE; k++) {
    p.line(ox + k * cell, oy, ox + k * cell, oy + W);
    p.line(ox, oy + k * cell, ox + W, oy + k * cell);
  }

  // Tàu (thân tàu nằm dưới dấu bắn).
  for (const ship of view.ships) if (!ship.style.startsWith('ghost')) drawShip(p, geo, colors, ship);

  // Dấu bắn.
  for (let i = 0; i < SIZE * SIZE; i++) {
    const m = view.marks[i];
    if (!m) continue;
    const r = Math.floor(i / SIZE), c = i % SIZE;
    if (m === 'miss') drawMiss(p, geo, colors, r, c);
    else drawHit(p, geo, colors, r, c, m === 'sunk');
  }

  // Vị trí dự kiến khi đặt tàu (vẽ trên cùng; phần ra ngoài bàn bị cắt).
  for (const ship of view.ships) if (ship.style.startsWith('ghost')) drawShip(p, geo, colors, ship);

  // Phát bắn gần nhất: khung viền.
  if (view.last >= 0) {
    const q = cellRect(geo, Math.floor(view.last / SIZE), view.last % SIZE);
    p.noFill();
    p.stroke(colors.aim);
    p.strokeWeight(Math.max(2, cell * 0.07));
    p.rect(q.x + 2, q.y + 2, q.s - 4, q.s - 4, 4);
  }

  // Ô đang trỏ khi ngắm.
  if (view.aim && view.hover >= 0 && !view.marks[view.hover]) {
    const { x, y } = center(geo, hr, hc);
    p.noFill();
    p.stroke(colors.aim);
    p.strokeWeight(Math.max(1.5, cell * 0.06));
    p.circle(x, y, cell * 0.62);
    p.line(x - cell * 0.42, y, x - cell * 0.16, y);
    p.line(x + cell * 0.16, y, x + cell * 0.42, y);
    p.line(x, y - cell * 0.42, x, y - cell * 0.16);
    p.line(x, y + cell * 0.16, x, y + cell * 0.42);
  }

  // Hiệu ứng ngắn (chỉ hình ảnh, không ảnh hưởng luật).
  for (const fx of view.effects) drawEffect(p, geo, colors, fx, now);

  if (view.dim) {
    p.noStroke();
    p.fill(0, 0, 0, 40);
    p.rect(ox, oy, W, W);
  }
  ctx.restore();
  p.pop();

  // Viền bàn.
  p.noFill();
  p.stroke(colors['sea-line']);
  p.strokeWeight(1.5);
  p.rect(ox, oy, W, W, 6);

  if (view.veil) drawVeil(p, geo, colors, view.veil);
}

function shipBox(geo, ship) {
  const { cell } = geo;
  const rs = ship.cells.map((q) => q.r), cs = ship.cells.map((q) => q.c);
  const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...cs), c1 = Math.max(...cs);
  const inset = cell * 0.12;
  return {
    x: geo.ox + c0 * cell + inset,
    y: geo.oy + r0 * cell + inset,
    w: (c1 - c0 + 1) * cell - inset * 2,
    h: (r1 - r0 + 1) * cell - inset * 2,
  };
}

/** Thân tàu: hình thuôn có mũi nhọn ở đầu tàu, tháp pháo dọc giữa thân. */
function hullPath(p, b, dir) {
  const ctx = p.drawingContext;
  const t = dir === 'h' ? b.h : b.w; // bề ngang thân tàu
  const rad = t * 0.42;
  ctx.beginPath();
  if (dir === 'h') {
    const tip = b.h * 0.55;
    ctx.moveTo(b.x + rad, b.y);
    ctx.lineTo(b.x + b.w - tip, b.y);
    ctx.quadraticCurveTo(b.x + b.w, b.y + b.h * 0.05, b.x + b.w, b.y + b.h / 2);
    ctx.quadraticCurveTo(b.x + b.w, b.y + b.h * 0.95, b.x + b.w - tip, b.y + b.h);
    ctx.lineTo(b.x + rad, b.y + b.h);
    ctx.arcTo(b.x, b.y + b.h, b.x, b.y + b.h - rad, rad);
    ctx.lineTo(b.x, b.y + rad);
    ctx.arcTo(b.x, b.y, b.x + rad, b.y, rad);
  } else {
    const tip = b.w * 0.55;
    ctx.moveTo(b.x, b.y + tip);
    ctx.quadraticCurveTo(b.x + b.w * 0.05, b.y, b.x + b.w / 2, b.y);
    ctx.quadraticCurveTo(b.x + b.w * 0.95, b.y, b.x + b.w, b.y + tip);
    ctx.lineTo(b.x + b.w, b.y + b.h - rad);
    ctx.arcTo(b.x + b.w, b.y + b.h, b.x + b.w - rad, b.y + b.h, rad);
    ctx.lineTo(b.x + rad, b.y + b.h);
    ctx.arcTo(b.x, b.y + b.h, b.x, b.y + b.h - rad, rad);
  }
  ctx.closePath();
}

function drawShip(p, geo, colors, ship) {
  const ctx = p.drawingContext;
  const b = shipBox(geo, ship);
  const { style, dir } = ship;
  ctx.save();
  hullPath(p, b, dir);
  const lw = Math.max(1.5, geo.cell * 0.06);
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  if (style === 'own' || style === 'held') {
    ctx.fillStyle = colors.ship;
    ctx.globalAlpha = style === 'held' ? 0.35 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors['ship-edge'];
    if (style === 'held') ctx.setLineDash([lw * 2.5, lw * 2]);
    ctx.stroke();
    if (style === 'own') drawDeck(p, geo, colors, ship);
  } else if (style === 'sunk') {
    ctx.fillStyle = colors.sunk;
    ctx.fill();
    // Gạch chéo trên thân tàu chìm.
    ctx.clip();
    ctx.strokeStyle = colors['sunk-edge'];
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, geo.cell * 0.05);
    const step = geo.cell * 0.28;
    for (let d = -b.h; d < b.w + b.h; d += step) {
      ctx.beginPath();
      ctx.moveTo(b.x + d, b.y + b.h);
      ctx.lineTo(b.x + d + b.h, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    hullPath(p, b, dir);
    ctx.lineWidth = lw;
    ctx.strokeStyle = colors['sunk-edge'];
    ctx.stroke();
  } else if (style === 'reveal') {
    // Tàu đối phương chưa bị đánh chìm, chỉ hiện khi ván đã kết thúc: viền đứt, nền trong suốt.
    ctx.fillStyle = colors.ship;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors['ship-edge'];
    ctx.setLineDash([lw * 2.5, lw * 1.8]);
    ctx.stroke();
  } else if (style === 'ghost-ok' || style === 'ghost-bad') {
    const ok = style === 'ghost-ok';
    const col = ok ? colors['preview-ok'] : colors['preview-bad'];
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw * 1.4;
    if (!ok) ctx.setLineDash([lw * 3, lw * 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Ký hiệu trong từng ô: ✓ (hợp lệ) hoặc ✕ (không hợp lệ) — không chỉ dựa vào màu.
    p.stroke(col);
    p.strokeWeight(Math.max(1.6, geo.cell * 0.07));
    p.noFill();
    for (const q of ship.cells) {
      const { x, y } = center(geo, q.r, q.c);
      const s = geo.cell * 0.14;
      if (ok) p.line(x - s, y, x - s * 0.2, y + s * 0.8), p.line(x - s * 0.2, y + s * 0.8, x + s * 1.2, y - s * 0.8);
      else p.line(x - s, y - s, x + s, y + s), p.line(x - s, y + s, x + s, y - s);
    }
  }
  ctx.restore();
}

function drawDeck(p, geo, colors, ship) {
  p.noStroke();
  p.fill(colors['ship-deck']);
  ship.cells.forEach((q, k) => {
    const { x, y } = center(geo, q.r, q.c);
    if (k === 0) return; // đuôi tàu để trống, các ô sau có tháp pháo
    p.circle(x, y, geo.cell * 0.26);
  });
}

function drawMiss(p, geo, colors, r, c) {
  const { x, y } = center(geo, r, c);
  p.noStroke();
  p.fill(colors.miss);
  p.circle(x, y, geo.cell * 0.26);
}

/** Dấu trúng: ✕ đậm có viền tương phản; ô thuộc tàu chìm vẽ ✕ nhỏ hơn trên thân tàu. */
function drawHit(p, geo, colors, r, c, sunk) {
  const { x, y } = center(geo, r, c);
  const s = geo.cell * (sunk ? 0.2 : 0.27);
  if (!sunk) {
    p.noStroke();
    p.fill(colors.hit);
    p.circle(x, y, geo.cell * 0.74);
  }
  p.strokeCap(p.ROUND);
  if (!sunk) {
    p.stroke(colors.hit);
    p.strokeWeight(geo.cell * 0.2);
    p.line(x - s, y - s, x + s, y + s);
    p.line(x - s, y + s, x + s, y - s);
  }
  p.stroke(colors['hit-mark']);
  p.strokeWeight(Math.max(2, geo.cell * (sunk ? 0.09 : 0.11)));
  p.line(x - s, y - s, x + s, y + s);
  p.line(x - s, y + s, x + s, y - s);
  p.strokeCap(p.SQUARE);
}

function drawEffect(p, geo, colors, fx, now) {
  const dur = effectDuration(fx.kind);
  const t = (now - fx.t0) / dur;
  if (t < 0 || t >= 1) return;
  const ctx = p.drawingContext;
  const { cell } = geo;
  if (fx.kind === 'miss') {
    const { x, y } = center(geo, fx.cells[0].r, fx.cells[0].c);
    p.noFill();
    p.stroke(colors.miss);
    for (const lag of [0, 0.25]) {
      const k = Math.max(0, (t - lag) / (1 - lag));
      if (k <= 0) continue;
      ctx.globalAlpha = 1 - k;
      p.strokeWeight(Math.max(1.2, cell * 0.06));
      p.circle(x, y, cell * (0.3 + k * 1.1));
    }
    ctx.globalAlpha = 1;
  } else if (fx.kind === 'hit') {
    const { x, y } = center(geo, fx.cells[0].r, fx.cells[0].c);
    ctx.globalAlpha = 1 - t;
    p.noStroke();
    p.fill(colors.hit);
    p.circle(x, y, cell * (0.6 + t * 1.2));
    p.stroke(colors.hit);
    p.strokeWeight(Math.max(1.5, cell * 0.07));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      const r0 = cell * (0.35 + t * 0.5), r1 = cell * (0.55 + t * 0.75);
      p.line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    }
    ctx.globalAlpha = 1;
  } else if (fx.kind === 'sunk') {
    // Viền sáng nhấp nháy quanh cả con tàu vừa chìm.
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
    ctx.globalAlpha = (1 - t) * (0.4 + 0.6 * pulse);
    p.noFill();
    p.stroke(colors.hit);
    p.strokeWeight(Math.max(2.5, cell * 0.12));
    const b = shipBox(geo, { cells: fx.cells });
    p.rect(b.x - cell * 0.08, b.y - cell * 0.08, b.w + cell * 0.16, b.h + cell * 0.16, cell * 0.25);
    ctx.globalAlpha = 1;
  }
}

function drawVeil(p, geo, colors, veil) {
  const { ox, oy, cell } = geo;
  const W = cell * SIZE;
  p.noStroke();
  p.fill(0, 0, 0, 120);
  p.rect(ox, oy, W, W, 6);
  p.fill(255);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(Math.max(14, Math.min(20, W / 18)));
  p.text(veil.title, ox + 16, oy + W / 2 - W * 0.1, W - 32, W * 0.12);
  p.textStyle(p.NORMAL);
  p.textSize(Math.max(12, Math.min(15, W / 26)));
  p.fill(255, 255, 255, 220);
  p.text(veil.sub || '', ox + 20, oy + W / 2, W - 40, W * 0.3);
}
