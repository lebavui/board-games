// Vẽ bàn Cờ caro 15×15 giao điểm bằng p5.js.
import { SIZE, BLACK, COLS } from './logic.js';

const WOOD = '#e3b873';
const WOOD_DARK = '#c99a52';
const LINE = '#5b3f1d';
const STARS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];

export function layout(availWidth, availHeight) {
  const side = Math.min(availWidth, availHeight, 680);
  return { width: side, height: side };
}

function geometry(size) {
  const margin = size * 0.055;
  const step = (size - margin * 2) / (SIZE - 1);
  return { margin, step };
}

/** Giao điểm gần nhất trong bán kính nửa ô, hoặc -1. */
export function pointAt(x, y, size) {
  const { margin, step } = geometry(size);
  const c = Math.round((x - margin) / step);
  const r = Math.round((y - margin) / step);
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return -1;
  const dx = x - (margin + c * step), dy = y - (margin + r * step);
  if (Math.hypot(dx, dy) > step * 0.62) return -1;
  return r * SIZE + c;
}

function drawStone(p, x, y, d, color) {
  const ctx = p.drawingContext;
  p.noStroke();
  p.fill('rgba(0,0,0,0.28)');
  p.circle(x + d * 0.05, y + d * 0.07, d);
  const grad = ctx.createRadialGradient(x - d * 0.18, y - d * 0.2, d * 0.05, x, y, d * 0.55);
  if (color === BLACK) {
    grad.addColorStop(0, '#5d5d66');
    grad.addColorStop(1, '#0d0d10');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#cfcfc8');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, d / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** view: { board, lastMove, winLine, showCoords } */
export function drawGomoku(p, size, view) {
  const { margin, step } = geometry(size);
  const ctx = p.drawingContext;
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, WOOD);
  bg.addColorStop(1, WOOD_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  p.stroke(LINE);
  p.strokeWeight(Math.max(1, step * 0.04));
  for (let k = 0; k < SIZE; k++) {
    p.line(margin, margin + k * step, margin + (SIZE - 1) * step, margin + k * step);
    p.line(margin + k * step, margin, margin + k * step, margin + (SIZE - 1) * step);
  }
  p.noStroke();
  p.fill(LINE);
  for (const [r, c] of STARS) p.circle(margin + c * step, margin + r * step, step * 0.2);

  if (view.showCoords) {
    p.fill('rgba(91, 63, 29, 0.75)');
    p.textSize(Math.max(8, margin * 0.42));
    p.textAlign(p.CENTER, p.CENTER);
    for (let k = 0; k < SIZE; k++) {
      p.text(COLS[k], margin + k * step, margin * 0.42);
      p.text(SIZE - k, margin * 0.42, margin + k * step);
    }
  }

  const d = step * 0.9;
  view.board.forEach((color, i) => {
    if (!color) return;
    drawStone(p, margin + (i % SIZE) * step, margin + Math.floor(i / SIZE) * step, d, color);
  });

  if (view.winLine) {
    const pts = view.winLine.map((i) => [margin + (i % SIZE) * step, margin + Math.floor(i / SIZE) * step]);
    p.stroke('rgba(220, 38, 38, 0.85)');
    p.strokeWeight(step * 0.14);
    p.strokeCap(p.ROUND);
    p.line(pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1]);
    p.noFill();
    p.strokeWeight(Math.max(2, step * 0.07));
    for (const [x, y] of pts) p.circle(x, y, d * 1.04);
    p.noStroke();
  }

  if (view.lastMove >= 0) {
    const x = margin + (view.lastMove % SIZE) * step, y = margin + Math.floor(view.lastMove / SIZE) * step;
    p.fill('#ef4444');
    p.circle(x, y, step * 0.26);
  }
}
