// Vẽ bàn Cờ đam bằng p5.js.
import { isKing, colorOf } from './logic.js';

const LIGHT = '#f1e2c4';
const DARK = '#7b5234';
const PIECE = {
  b: { fill: '#2a2830', ring: '#4a4752', edge: '#0f0e12' },
  r: { fill: '#c43a32', ring: '#e2675d', edge: '#6d1612' },
};

export function layout(availWidth, availHeight) {
  const side = Math.min(availWidth, availHeight, 640);
  return { width: side, height: side };
}

export function squareAt(x, y, size, flipped) {
  const cell = size / 8;
  let c = Math.floor(x / cell), r = Math.floor(y / cell);
  if (r < 0 || c < 0 || r > 7 || c > 7) return -1;
  if (flipped) { r = 7 - r; c = 7 - c; }
  return r * 8 + c;
}

function origin(i, cell, flipped) {
  let r = Math.floor(i / 8), c = i % 8;
  if (flipped) { r = 7 - r; c = 7 - c; }
  return [c * cell, r * cell];
}

function drawCrown(p, cx, cy, s) {
  p.fill('#f5c542');
  p.stroke('#8a6510');
  p.strokeWeight(Math.max(1, s * 0.03));
  p.beginShape();
  const pts = [[-0.24, 0.12], [-0.28, -0.12], [-0.13, 0.0], [0, -0.17], [0.13, 0.0], [0.28, -0.12], [0.24, 0.12]];
  for (const [x, y] of pts) p.vertex(cx + x * s, cy + y * s);
  p.endShape(p.CLOSE);
  p.noStroke();
}

/**
 * view: { board, flipped, selected, targets:[idx], movable:Set, lastPath:[idx], showNumbers }
 */
export function drawCheckers(p, size, view) {
  const cell = size / 8;
  p.noStroke();
  for (let i = 0; i < 64; i++) {
    const [x, y] = origin(i, cell, view.flipped);
    const r = Math.floor(i / 8), c = i % 8;
    p.fill((r + c) % 2 === 1 ? DARK : LIGHT);
    p.rect(x, y, cell, cell);
  }
  if (view.lastPath) {
    for (const i of view.lastPath) {
      const [x, y] = origin(i, cell, view.flipped);
      p.fill('rgba(255, 214, 10, 0.32)');
      p.rect(x, y, cell, cell);
    }
  }
  if (view.selected !== null) {
    const [x, y] = origin(view.selected, cell, view.flipped);
    p.fill('rgba(129, 140, 248, 0.6)');
    p.rect(x, y, cell, cell);
  }

  if (view.showNumbers) {
    p.textSize(Math.max(8, cell * 0.16));
    p.textAlign(p.LEFT, p.TOP);
    p.fill('rgba(255,255,255,0.5)');
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      if ((r + c) % 2 !== 1) continue;
      const [x, y] = origin(i, cell, view.flipped);
      p.text(r * 4 + Math.floor(c / 2) + 1, x + cell * 0.06, y + cell * 0.05);
    }
  }

  for (let i = 0; i < 64; i++) {
    const piece = view.board[i];
    if (!piece) continue;
    const [x, y] = origin(i, cell, view.flipped);
    const cx = x + cell / 2, cy = y + cell / 2;
    const style = PIECE[colorOf(piece)];
    if (view.movable.has(i)) {
      p.fill('rgba(250, 204, 21, 0.55)');
      p.circle(cx, cy, cell * 0.96);
    }
    p.fill('rgba(0,0,0,0.3)');
    p.circle(cx, cy + cell * 0.05, cell * 0.8);
    p.fill(style.edge);
    p.circle(cx, cy, cell * 0.8);
    p.fill(style.fill);
    p.circle(cx, cy - cell * 0.03, cell * 0.74);
    p.noFill();
    p.stroke(style.ring);
    p.strokeWeight(Math.max(1, cell * 0.035));
    p.circle(cx, cy - cell * 0.03, cell * 0.5);
    p.noStroke();
    if (isKing(piece)) drawCrown(p, cx, cy - cell * 0.03, cell);
  }

  for (const t of view.targets) {
    const [x, y] = origin(t, cell, view.flipped);
    p.fill('rgba(250, 250, 250, 0.55)');
    p.circle(x + cell / 2, y + cell / 2, cell * 0.3);
    p.noFill();
    p.stroke('rgba(30, 27, 75, 0.5)');
    p.strokeWeight(2);
    p.circle(x + cell / 2, y + cell / 2, cell * 0.3);
    p.noStroke();
  }
}
