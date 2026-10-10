// Vẽ bàn cờ vua bằng p5.js.
import { drawPiece } from './pieces.js';

const LIGHT = '#eedfc7';
const DARK = '#b58863';
const FILES = 'abcdefgh';

export function layout(availWidth, availHeight) {
  const side = Math.min(availWidth, availHeight, 640);
  return { width: side, height: side };
}

export function squareAt(x, y, size, flipped) {
  const cell = size / 8;
  const dc = Math.floor(x / cell), dr = Math.floor(y / cell);
  if (dc < 0 || dr < 0 || dc > 7 || dr > 7) return null;
  const file = flipped ? 7 - dc : dc;
  const rank = flipped ? dr + 1 : 8 - dr;
  return FILES[file] + rank;
}

function squareOrigin(square, cell, flipped) {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const dc = flipped ? 7 - file : file;
  const dr = flipped ? rank - 1 : 8 - rank;
  return [dc * cell, dr * cell];
}

/**
 * view: { board, flipped, selected, targets:[{to, capture}], lastMove:{from,to}, checkSquare, accent }
 */
export function drawChess(p, size, view) {
  const cell = size / 8;
  p.noStroke();
  for (let dr = 0; dr < 8; dr++) {
    for (let dc = 0; dc < 8; dc++) {
      p.fill((dr + dc) % 2 === 0 ? LIGHT : DARK);
      p.rect(dc * cell, dr * cell, cell, cell);
    }
  }

  const tint = (square, color) => {
    const [x, y] = squareOrigin(square, cell, view.flipped);
    p.fill(color);
    p.rect(x, y, cell, cell);
  };
  if (view.lastMove) {
    tint(view.lastMove.from, 'rgba(255, 214, 10, 0.38)');
    tint(view.lastMove.to, 'rgba(255, 214, 10, 0.5)');
  }
  if (view.selected) tint(view.selected, 'rgba(79, 70, 229, 0.45)');
  if (view.checkSquare) {
    const [x, y] = squareOrigin(view.checkSquare, cell, view.flipped);
    const ctx = p.drawingContext;
    const grad = ctx.createRadialGradient(x + cell / 2, y + cell / 2, cell * 0.1, x + cell / 2, y + cell / 2, cell * 0.72);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, cell, cell);
  }

  // Tọa độ
  p.textStyle(p.BOLD);
  p.textSize(Math.max(9, cell * 0.17));
  for (let i = 0; i < 8; i++) {
    const fileLabel = FILES[view.flipped ? 7 - i : i];
    p.fill((7 + i) % 2 === 0 ? DARK : LIGHT);
    p.textAlign(p.RIGHT, p.BOTTOM);
    p.text(fileLabel, (i + 1) * cell - cell * 0.06, size - cell * 0.03);
    const rankLabel = view.flipped ? i + 1 : 8 - i;
    p.fill(i % 2 === 0 ? DARK : LIGHT);
    p.textAlign(p.LEFT, p.TOP);
    p.text(rankLabel, cell * 0.06, i * cell + cell * 0.05);
  }
  p.textStyle(p.NORMAL);

  // Quân cờ
  for (const row of view.board) {
    for (const sq of row) {
      if (!sq) continue;
      const [x, y] = squareOrigin(sq.square, cell, view.flipped);
      drawPiece(p, sq.type, sq.color, x + cell / 2, y + cell / 2, cell * 0.92);
    }
  }

  // Nước đi hợp lệ của quân đang chọn
  for (const t of view.targets) {
    const [x, y] = squareOrigin(t.to, cell, view.flipped);
    if (t.capture) {
      p.noFill();
      p.stroke('rgba(30, 27, 75, 0.45)');
      p.strokeWeight(cell * 0.08);
      p.circle(x + cell / 2, y + cell / 2, cell * 0.88);
      p.noStroke();
    } else {
      p.fill('rgba(30, 27, 75, 0.32)');
      p.circle(x + cell / 2, y + cell / 2, cell * 0.3);
    }
  }
}
