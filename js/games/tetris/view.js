// Vẽ giếng Xếp gạch bằng p5.js: giếng 10×20 bên trái, cột phải gồm ô Giữ và hàng đợi khối tiếp theo.
import { COLS, HIDDEN_ROWS, VISIBLE_ROWS, NEXT_COUNT, shapeCells, pieceCells, ghostY } from './logic.js';

export const COLOR_NAMES = ['well', 'well-grid', 'grid-line', 'surface', 'surface-2', 'text', 'text-muted', 'accent', 'success', 'danger'];

// Màu chuẩn của bảy khối; mỗi khối còn có hình dạng riêng nên không phân biệt chỉ bằng màu.
export const PIECE_COLORS = {
  I: '#06b6d4', O: '#eab308', T: '#a855f7', S: '#22c55e', Z: '#ef4444', J: '#3b82f6', L: '#f97316',
};

const SIDE_CELLS = 5;   // độ rộng cột phải tính theo ô
const GAP_CELLS = 0.5;
const MESSAGE_MS = 1500;

export function layout(availWidth, availHeight) {
  const cell = Math.floor(Math.max(12, Math.min(availWidth / (COLS + GAP_CELLS + SIDE_CELLS), availHeight / VISIBLE_ROWS, 34)));
  return { cell, width: cell * (COLS + GAP_CELLS + SIDE_CELLS), height: cell * VISIBLE_ROWS };
}

function block(p, x, y, s, color) {
  const inset = Math.max(1, s * 0.06);
  p.noStroke();
  p.fill(color);
  p.rect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, Math.min(4, s * 0.14));
  // Viền sáng trên-trái và tối dưới-phải tạo cảm giác nổi.
  p.fill(255, 255, 255, 70);
  p.rect(x + inset, y + inset, s - 2 * inset, s * 0.18, Math.min(4, s * 0.14), Math.min(4, s * 0.14), 0, 0);
  p.fill(0, 0, 0, 45);
  p.rect(x + inset, y + s - inset - s * 0.16, s - 2 * inset, s * 0.16, 0, 0, Math.min(4, s * 0.14), Math.min(4, s * 0.14));
}

/** Vẽ một khối nhỏ căn giữa trong khung (x, y, w, h). */
function miniPiece(p, type, x, y, w, h, s, faded) {
  const cells = shapeCells(type, 0);
  const minX = Math.min(...cells.map((c) => c[0])), maxX = Math.max(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1])), maxY = Math.max(...cells.map((c) => c[1]));
  const ox = x + (w - (maxX - minX + 1) * s) / 2 - minX * s;
  const oy = y + (h - (maxY - minY + 1) * s) / 2 - minY * s;
  const color = faded ? p.color(128, 128, 128, 140) : PIECE_COLORS[type];
  for (const [cx, cy] of cells) block(p, ox + cx * s, oy + cy * s, s, color);
}

function label(p, text, x, y, size, colors) {
  p.noStroke();
  p.fill(colors['text-muted']);
  p.textAlign(p.LEFT, p.TOP);
  p.textStyle(p.BOLD);
  p.textSize(size);
  p.text(text, x, y);
}

function clearMessage(info) {
  const names = ['', 'Đơn', 'Đôi', 'Ba'];
  const parts = [];
  if (info.tspin) parts.push(info.lines ? `T-Spin ${names[info.lines] || ''}`.trim() : 'T-Spin');
  else if (info.lines === 4) parts.push('Tetris!');
  if (info.b2b) parts.unshift('B2B');
  if (info.combo > 0) parts.push(`Combo ${info.combo}`);
  return parts.join(' · ');
}

export function drawTetris(p, geo, game, colors, { showGhost = true } = {}) {
  const s = geo.cell;
  const wellW = COLS * s, wellH = VISIBLE_ROWS * s;
  const top = (row) => (row - HIDDEN_ROWS) * s;

  // Giếng và lưới.
  p.noStroke();
  p.fill(colors.well);
  p.rect(0, 0, wellW, wellH, 6);
  p.stroke(colors['well-grid']);
  p.strokeWeight(1);
  for (let c = 1; c < COLS; c++) p.line(c * s + 0.5, 0, c * s + 0.5, wellH);
  for (let r = 1; r < VISIBLE_ROWS; r++) p.line(0, r * s + 0.5, wellW, r * s + 0.5);

  const over = game.status === 'over';
  for (let r = HIDDEN_ROWS; r < HIDDEN_ROWS + VISIBLE_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = game.board[r * COLS + c];
      if (v) block(p, c * s, top(r), s, over ? p.color(128, 128, 128) : PIECE_COLORS[v]);
    }
  }

  if (game.piece && !over) {
    // Bóng khối: chỉ viền + nền mờ, khác hẳn khối thật.
    if (showGhost) {
      const gy = ghostY(game);
      if (gy !== game.piece.y) {
        const col = p.color(PIECE_COLORS[game.piece.type]);
        for (const [x, y] of pieceCells({ ...game.piece, y: gy })) {
          if (y < HIDDEN_ROWS) continue;
          col.setAlpha(45);
          p.fill(col);
          col.setAlpha(220);
          p.stroke(col);
          p.strokeWeight(Math.max(1.5, s * 0.07));
          const inset = s * 0.12;
          p.rect(x * s + inset, top(y) + inset, s - 2 * inset, s - 2 * inset, 3);
        }
      }
    }
    for (const [x, y] of pieceCells(game.piece)) {
      if (y >= HIDDEN_ROWS) block(p, x * s, top(y), s, PIECE_COLORS[game.piece.type]);
    }
  }

  // Cột phải: ô Giữ và hàng đợi.
  const sx = wellW + GAP_CELLS * s, sw = SIDE_CELLS * s;
  const labelSize = Math.max(10, s * 0.48);
  const mini = s * 0.62;
  const box = (y, h) => {
    p.noStroke();
    p.fill(colors.well);
    p.rect(sx, y, sw, h, 6);
  };
  label(p, 'GIỮ', sx + 2, 0, labelSize, colors);
  const holdY = labelSize * 1.4, holdH = s * 2.6;
  box(holdY, holdH);
  if (game.hold) miniPiece(p, game.hold, sx, holdY, sw, holdH, mini, game.holdUsed);

  const nextLabelY = holdY + holdH + s * 0.6;
  label(p, 'TIẾP', sx + 2, nextLabelY, labelSize, colors);
  const queueY = nextLabelY + labelSize * 1.4;
  const slot = Math.min(s * 2.4, (wellH - queueY) / NEXT_COUNT);
  box(queueY, slot * NEXT_COUNT);
  game.queue.slice(0, NEXT_COUNT).forEach((type, k) => {
    miniPiece(p, type, sx, queueY + k * slot, sw, slot, k === 0 ? mini : mini * 0.82, false);
  });

  // Thông báo xóa hàng đặc biệt (Tetris, T-spin, combo).
  const info = game.lastClear;
  if (info && !over && game.elapsedMs - info.at < MESSAGE_MS) {
    const msg = clearMessage(info);
    if (msg) {
      p.textAlign(p.CENTER, p.CENTER);
      p.textStyle(p.BOLD);
      p.textSize(Math.max(13, s * 0.62));
      const tw = p.textWidth(msg) + s;
      p.noStroke();
      p.fill(0, 0, 0, 150);
      p.rect(wellW / 2 - tw / 2, s * 3, tw, s * 1.3, 8);
      p.fill(255);
      p.text(msg, wellW / 2, s * 3.65);
    }
  }

  // Lớp phủ khi chưa bắt đầu, tạm dừng hoặc kết thúc.
  const overlays = {
    ready: ['Sẵn sàng', 'Nhấn Bắt đầu, phím Enter hoặc chạm vào giếng'],
    paused: ['Tạm dừng', 'Nhấn Tiếp tục, phím P hoặc chạm vào giếng'],
    over: ['Kết thúc', `${game.score.toLocaleString('vi-VN')} điểm`],
  };
  const ov = overlays[game.status];
  if (ov) {
    p.noStroke();
    p.fill(0, 0, 0, over ? 110 : 150);
    p.rect(0, 0, wellW, wellH, 6);
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textSize(Math.max(18, s * 1.05));
    p.text(ov[0], wellW / 2, wellH / 2 - s * 0.7);
    p.textStyle(p.NORMAL);
    p.textSize(Math.max(11, s * 0.45));
    p.text(ov[1], s * 0.5, wellH / 2, wellW - s, s * 2);
  }
  if (over) {
    p.noFill();
    p.stroke(colors.danger);
    p.strokeWeight(3);
    p.rect(1.5, 1.5, wellW - 3, wellH - 3, 6);
  }
  p.textStyle(p.NORMAL);
}
