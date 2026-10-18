// Vẽ bàn Cờ tướng bằng p5.js: 9×10 giao điểm, sông, cung Tướng, số cột hai phía và quân tròn có chữ.
import { COLS, ROWS, colorOf, kindOf } from './logic.js';

const WOOD = '#e6c18a';
const LINE = '#5b3f1d';
const PIECE_FACE = '#f7e9c8';
const PIECE_EDGE = '#9c7a45';
const INK = { r: '#c0262d', b: '#1d1d24' };
const HAN = {
  r: { k: '帥', a: '仕', b: '相', n: '傌', r: '俥', c: '炮', p: '兵' },
  b: { k: '將', a: '士', b: '象', n: '馬', r: '車', c: '砲', p: '卒' },
};
const VIET = { k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt' };
const LABEL_BAND = 0.55; // dải ghi số cột phía trên/dưới, tính theo ô

export function layout(availWidth, availHeight) {
  const cell = Math.min(availWidth / COLS, availHeight / (ROWS + 2 * LABEL_BAND), 68);
  return { width: cell * COLS, height: cell * (ROWS + 2 * LABEL_BAND), cell };
}

function point(i, cell, flipped) {
  let r = Math.floor(i / COLS), c = i % COLS;
  if (flipped) { r = ROWS - 1 - r; c = COLS - 1 - c; }
  return [(c + 0.5) * cell, (r + 0.5 + LABEL_BAND) * cell];
}

/** Giao điểm gần vị trí chạm nhất (trong phạm vi nửa ô), hoặc -1. */
export function pointAt(x, y, cell, flipped) {
  let c = Math.round(x / cell - 0.5), r = Math.round(y / cell - 0.5 - LABEL_BAND);
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return -1;
  if (flipped) { r = ROWS - 1 - r; c = COLS - 1 - c; }
  return r * COLS + c;
}

function drawGrid(p, cell, view) {
  const x0 = cell / 2, x1 = (COLS - 0.5) * cell;
  const y = (r) => (r + 0.5 + LABEL_BAND) * cell;
  p.stroke(LINE);
  p.strokeWeight(Math.max(1, cell * 0.025));
  for (let r = 0; r < ROWS; r++) p.line(x0, y(r), x1, y(r));
  for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) * cell;
    if (c === 0 || c === COLS - 1) p.line(x, y(0), x, y(ROWS - 1));
    else { p.line(x, y(0), x, y(4)); p.line(x, y(5), x, y(ROWS - 1)); } // sông cắt ngang các đường dọc giữa
  }
  // Cung Tướng: hai đường chéo ở mỗi bên.
  for (const [r0, r1] of [[0, 2], [7, 9]]) {
    p.line(3.5 * cell, y(r0), 5.5 * cell, y(r1));
    p.line(5.5 * cell, y(r0), 3.5 * cell, y(r1));
  }
  p.strokeWeight(Math.max(1.5, cell * 0.05));
  p.noFill();
  p.rect(x0 - cell * 0.08, y(0) - cell * 0.08, x1 - x0 + cell * 0.16, y(ROWS - 1) - y(0) + cell * 0.16);

  // Dấu vị trí Pháo và Tốt ban đầu.
  p.strokeWeight(Math.max(1, cell * 0.022));
  const g = cell * 0.08, len = cell * 0.16;
  const marks = [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]];
  for (const [r, c] of marks) {
    const cx = (c + 0.5) * cell, cy = y(r);
    for (const sx of [-1, 1]) {
      if ((sx < 0 && c === 0) || (sx > 0 && c === COLS - 1)) continue;
      for (const sy of [-1, 1]) {
        p.line(cx + sx * g, cy + sy * g, cx + sx * (g + len), cy + sy * g);
        p.line(cx + sx * g, cy + sy * g, cx + sx * g, cy + sy * (g + len));
      }
    }
  }

  // Chữ trên sông và số cột.
  p.noStroke();
  p.fill(LINE);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  const riverY = (y(4) + y(5)) / 2;
  const [left, right] = view.han ? ['楚 河', '漢 界'] : ['SỞ HÀ', 'HÁN GIỚI'];
  p.textSize(cell * (view.han ? 0.5 : 0.36));
  p.text(view.flipped ? right : left, 2.5 * cell, riverY);
  p.text(view.flipped ? left : right, 6.5 * cell, riverY);

  // Số cột 1–9 theo phía mỗi người chơi (tính từ phải sang trái của người đó).
  p.textStyle(p.NORMAL);
  p.textSize(Math.max(9, cell * 0.26));
  for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) * cell;
    const logical = view.flipped ? COLS - 1 - c : c;
    const top = view.flipped ? COLS - logical : logical + 1;      // phía trên màn hình
    const bottom = view.flipped ? logical + 1 : COLS - logical;   // phía dưới màn hình
    p.fill(view.flipped ? INK.r : INK.b);
    p.text(top, x, LABEL_BAND * cell * 0.5);
    p.fill(view.flipped ? INK.b : INK.r);
    p.text(bottom, x, p.height - LABEL_BAND * cell * 0.5);
  }
}

function drawPiece(p, cx, cy, cell, piece, han) {
  const color = colorOf(piece), kind = kindOf(piece);
  const d = cell * 0.86;
  p.noStroke();
  p.fill(0, 0, 0, 70);
  p.circle(cx, cy + cell * 0.04, d);
  p.fill(PIECE_EDGE);
  p.circle(cx, cy, d);
  p.fill(PIECE_FACE);
  p.circle(cx, cy - cell * 0.02, d * 0.92);
  p.noFill();
  p.stroke(INK[color]);
  p.strokeWeight(Math.max(1, cell * 0.03));
  p.circle(cx, cy - cell * 0.02, d * 0.74);
  p.noStroke();
  p.fill(INK[color]);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  if (han) {
    p.textSize(cell * 0.44);
    p.text(HAN[color][kind], cx, cy - cell * 0.04);
  } else {
    const word = VIET[kind];
    p.textSize(cell * (word.length >= 5 ? 0.2 : word.length >= 4 ? 0.23 : 0.28));
    p.text(word, cx, cy - cell * 0.02);
  }
  p.textStyle(p.NORMAL);
}

/**
 * view: { board, flipped, han, selected, targets:[{to, capture}], lastMove:{from,to}, checkKing }
 */
export function drawXiangqi(p, geo, view) {
  const { cell } = geo;
  p.noStroke();
  p.fill(WOOD);
  p.rect(0, 0, p.width, p.height, 8);
  drawGrid(p, cell, view);

  if (view.lastMove) {
    for (const i of [view.lastMove.from, view.lastMove.to]) {
      const [x, y] = point(i, cell, view.flipped);
      p.noFill();
      p.stroke(37, 99, 235, 200);
      p.strokeWeight(Math.max(2, cell * 0.05));
      const s = cell * 0.48, k = cell * 0.16;
      // Bốn góc vuông đánh dấu nước vừa đi (thấy được cả khi ô đã trống).
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        p.line(x + sx * s, y + sy * s, x + sx * (s - k), y + sy * s);
        p.line(x + sx * s, y + sy * s, x + sx * s, y + sy * (s - k));
      }
    }
  }

  if (view.checkKing >= 0) {
    const [x, y] = point(view.checkKing, cell, view.flipped);
    const ctx = p.drawingContext;
    const grad = ctx.createRadialGradient(x, y, cell * 0.2, x, y, cell * 0.75);
    grad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - cell, y - cell, cell * 2, cell * 2);
  }

  for (let i = 0; i < view.board.length; i++) {
    if (!view.board[i]) continue;
    const [x, y] = point(i, cell, view.flipped);
    if (i === view.selected) {
      p.noStroke();
      p.fill(79, 70, 229, 150);
      p.circle(x, y, cell * 1.0);
    }
    drawPiece(p, x, y - (i === view.selected ? cell * 0.04 : 0), cell, view.board[i], view.han);
  }

  for (const t of view.targets) {
    const [x, y] = point(t.to, cell, view.flipped);
    if (t.capture) {
      p.noFill();
      p.stroke(220, 38, 38, 220);
      p.strokeWeight(Math.max(2, cell * 0.06));
      p.circle(x, y, cell * 0.92);
    } else {
      p.fill(79, 70, 229, 170);
      p.stroke(255, 255, 255, 200);
      p.strokeWeight(1.5);
      p.circle(x, y, cell * 0.28);
    }
  }
  p.noStroke();
}
