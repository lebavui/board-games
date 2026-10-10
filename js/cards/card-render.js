// Vẽ lá bài bằng p5.js — tự vẽ hoàn toàn (vector), không dùng ảnh hay ký tự emoji.
// Góc trên lá bài luôn có hạng + chất trong một dải cao ~28% lá, nên khi xếp chồng lệch (fan)
// trên điện thoại vẫn đọc được hạng và chất của từng lá.
import { cardOf, isRed, RANK_LABELS } from './deck.js';

export const CARD_COLOR_NAMES = [
  'felt', 'felt-line', 'card-face', 'card-edge', 'card-red', 'card-black',
  'card-back', 'card-back-2', 'card-select', 'card-hint', 'text', 'accent',
];
export const CARD_RATIO = 1.4;
/** Tỷ lệ dải chỉ số (hạng + chất) ở góc trên, so với chiều cao lá. */
export const INDEX_STRIP = 0.3;

/* ---------- Ký hiệu chất (vector) ---------- */

export function drawSuit(p, suit, cx, cy, s) {
  p.noStroke();
  if (suit === 'D') {
    p.quad(cx, cy - s * 0.5, cx + s * 0.38, cy, cx, cy + s * 0.5, cx - s * 0.38, cy);
  } else if (suit === 'H') {
    const r = s * 0.54;
    p.circle(cx - s * 0.235, cy - s * 0.16, r);
    p.circle(cx + s * 0.235, cy - s * 0.16, r);
    p.triangle(cx - s * 0.49, cy - s * 0.06, cx + s * 0.49, cy - s * 0.06, cx, cy + s * 0.48);
  } else if (suit === 'S') {
    const r = s * 0.5;
    p.circle(cx - s * 0.22, cy + s * 0.07, r);
    p.circle(cx + s * 0.22, cy + s * 0.07, r);
    p.triangle(cx - s * 0.46, cy - s * 0.02, cx + s * 0.46, cy - s * 0.02, cx, cy - s * 0.5);
    p.triangle(cx, cy + s * 0.05, cx - s * 0.17, cy + s * 0.5, cx + s * 0.17, cy + s * 0.5);
  } else {
    const r = s * 0.44;
    p.circle(cx, cy - s * 0.26, r);
    p.circle(cx - s * 0.25, cy + s * 0.08, r);
    p.circle(cx + s * 0.25, cy + s * 0.08, r);
    p.rect(cx - s * 0.09, cy - s * 0.2, s * 0.18, s * 0.3);
    p.triangle(cx, cy - s * 0.02, cx - s * 0.18, cy + s * 0.5, cx + s * 0.18, cy + s * 0.5);
  }
}

function rankText(p, label, x, y, size) {
  p.textSize(size);
  if (label.length > 1) {
    // "10" hẹp lại để vừa góc lá bài nhỏ.
    p.push();
    p.translate(x, y);
    p.scale(0.78, 1);
    p.text(label, 0, 0);
    p.pop();
  } else {
    p.text(label, x, y);
  }
}

/* ---------- Lá bài ---------- */

/**
 * Vẽ một lá bài tại (x, y) với kích thước w × h.
 * opts: { up, scaleX (lật), highlight: 'select'|'hint'|null, dim, sideIndex }
 * sideIndex: thêm chất nhỏ dưới hạng ở mép trái — dùng khi bài xòe ngang che mất nửa phải của lá.
 */
export function drawCard(p, id, x, y, w, h, colors, opts = {}) {
  const { up = true, scaleX = 1, highlight = null, dim = false, shadow = false, sideIndex = false } = opts;
  const r = Math.max(3, w * 0.08);
  p.push();
  p.translate(x + w / 2, y);
  if (scaleX !== 1) p.scale(Math.max(0.02, scaleX), 1);
  p.translate(-w / 2, 0);

  if (shadow) {
    p.noStroke();
    p.fill(0, 0, 0, 55);
    p.rect(2, 4, w, h, r);
  }
  p.strokeWeight(1);
  p.stroke(colors['card-edge']);
  if (up) {
    p.fill(colors['card-face']);
    p.rect(0, 0, w, h, r);
    drawFace(p, cardOf(id), w, h, colors, sideIndex);
  } else {
    drawBack(p, w, h, r, colors);
  }
  if (dim) {
    p.noStroke();
    p.fill(0, 0, 0, 70);
    p.rect(0, 0, w, h, r);
  }
  if (highlight) {
    p.noFill();
    p.stroke(colors[highlight === 'hint' ? 'card-hint' : 'card-select']);
    p.strokeWeight(Math.max(2.5, w * 0.05));
    p.rect(-1, -1, w + 2, h + 2, r + 1);
  }
  p.pop();
}

function drawFace(p, card, w, h, colors, sideIndex = false) {
  const color = isRed(card.suit) ? colors['card-red'] : colors['card-black'];
  const label = RANK_LABELS[card.rank];
  const strip = h * INDEX_STRIP;
  const fs = Math.min(w * 0.4, strip * 0.92);
  const pad = w * 0.07;

  // Chỉ số góc trên: hạng (trái) + chất (phải) trên cùng một dải.
  p.noStroke();
  p.fill(color);
  p.textStyle(p.BOLD);
  p.textAlign(p.LEFT, p.CENTER);
  rankText(p, label, pad, strip * 0.55, fs);
  const ss = Math.min(w * 0.3, strip * 0.72);
  drawSuit(p, card.suit, w - pad - ss * 0.42, strip * 0.55, ss);

  if (sideIndex) drawSuit(p, card.suit, pad + fs * 0.3, strip + ss * 0.45, ss * 0.85);

  // Phần giữa (lệch phải một chút khi có chất ở mép trái).
  const cx = sideIndex ? w * 0.58 : w / 2;
  const cy = strip + (h - strip) * 0.5;
  const body = Math.min(w * 0.62, (h - strip) * 0.62) * (sideIndex ? 0.85 : 1);
  if (card.rank > 10) {
    const fx = sideIndex ? w * 0.3 : w * 0.16, fy = strip + h * 0.04, fw = sideIndex ? w * 0.58 : w * 0.68, fh = h - strip - h * 0.1;
    p.noFill();
    p.stroke(color);
    p.strokeWeight(Math.max(1, w * 0.02));
    p.rect(fx, fy, fw, fh, w * 0.05);
    p.noStroke();
    p.fill(color);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(Math.min(fw * 0.62, fh * 0.5));
    p.text(label, fx + fw / 2, fy + fh * 0.42);
    drawSuit(p, card.suit, fx + fw / 2, fy + fh * 0.8, Math.min(fw, fh) * 0.24);
  } else if (card.rank === 1) {
    drawSuit(p, card.suit, cx, cy, body * 1.05);
  } else {
    drawSuit(p, card.suit, cx, cy, body * 0.85);
    if (w >= 64) {
      // Lá lớn: thêm chỉ số nhỏ lộn ngược ở góc dưới như bài thật.
      p.push();
      p.translate(w, h);
      p.rotate(Math.PI);
      p.textAlign(p.LEFT, p.CENTER);
      rankText(p, label, pad, strip * 0.4, fs * 0.6);
      p.pop();
    }
  }
  p.textStyle(p.NORMAL);
}

function drawBack(p, w, h, r, colors) {
  p.fill(colors['card-back']);
  p.rect(0, 0, w, h, r);
  const m = Math.max(2, w * 0.08);
  p.noFill();
  p.stroke(colors['card-back-2']);
  p.strokeWeight(Math.max(1, w * 0.025));
  p.rect(m, m, w - 2 * m, h - 2 * m, r * 0.6);
  // Họa tiết hình thoi lồng nhau ở giữa.
  const cx = w / 2, cy = h / 2;
  for (const k of [0.32, 0.2]) {
    p.quad(cx, cy - h * k, cx + w * k, cy, cx, cy + h * k, cx - w * k, cy);
  }
  p.noStroke();
  p.fill(colors['card-back-2']);
  p.circle(cx, cy, w * 0.12);
}

/** Ô trống (chỗ đặt bài) có nhãn tùy chọn ở giữa. */
export function drawSlot(p, x, y, w, h, colors, { label = '', suit = null, active = false } = {}) {
  const r = Math.max(3, w * 0.08);
  p.push();
  p.noFill();
  p.stroke(active ? colors['card-hint'] : colors['felt-line']);
  p.strokeWeight(active ? Math.max(2.5, w * 0.05) : Math.max(1.2, w * 0.025));
  p.drawingContext.setLineDash(active ? [] : [Math.max(3, w * 0.07), Math.max(3, w * 0.06)]);
  p.rect(x + 1, y + 1, w - 2, h - 2, r);
  p.drawingContext.setLineDash([]);
  p.noStroke();
  p.fill(colors['felt-line']);
  if (suit) drawSuit(p, suit, x + w / 2, y + h / 2, w * 0.4);
  else if (label) {
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(Math.min(w * 0.36, 30));
    p.text(label, x + w / 2, y + h / 2);
    p.textStyle(p.NORMAL);
  }
  p.pop();
}
