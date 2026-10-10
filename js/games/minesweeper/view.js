// Vẽ bàn Dò mìn bằng p5.js. Trên màn hình dọc hẹp, bàn rộng (30×16) được xoay 90° để ô đủ lớn.
export const COLOR_NAMES = ['mine-hidden', 'mine-hidden-edge', 'mine-open', 'grid-line', 'text', 'danger', 'danger-soft', 'success'];

const NUMBER_COLORS_LIGHT = ['', '#2563eb', '#15803d', '#dc2626', '#1e3a8a', '#9f1239', '#0e7490', '#111827', '#6b7280'];
const NUMBER_COLORS_DARK = ['', '#60a5fa', '#4ade80', '#f87171', '#a5b4fc', '#fb7185', '#22d3ee', '#e5e7eb', '#9ca3af'];

/** Tính bố cục; trả về cả cờ `transposed` để dùng cho vẽ và xác định ô được chạm. */
export function layout(game, availWidth, availHeight) {
  const normal = Math.min(availWidth / game.cols, availHeight / game.rows);
  const rotated = Math.min(availWidth / game.rows, availHeight / game.cols);
  const transposed = game.cols > game.rows && availWidth < availHeight && rotated > normal * 1.25;
  const cols = transposed ? game.rows : game.cols;
  const rows = transposed ? game.cols : game.rows;
  const cell = Math.max(14, Math.min(transposed ? rotated : normal, 44));
  return { width: cell * cols, height: cell * rows, cell, transposed };
}

/** Đổi tọa độ màn hình sang chỉ số ô logic. */
export function hitTest(game, geo, x, y) {
  const vc = Math.floor(x / geo.cell), vr = Math.floor(y / geo.cell);
  const r = geo.transposed ? vc : vr;
  const c = geo.transposed ? vr : vc;
  if (r < 0 || c < 0 || r >= game.rows || c >= game.cols) return -1;
  return r * game.cols + c;
}

function drawFlag(p, cx, cy, s, color) {
  p.stroke(color);
  p.strokeWeight(Math.max(1.5, s * 0.07));
  p.line(cx - s * 0.12, cy - s * 0.3, cx - s * 0.12, cy + s * 0.28);
  p.noStroke();
  p.fill('#ef4444');
  p.triangle(cx - s * 0.1, cy - s * 0.32, cx + s * 0.3, cy - s * 0.16, cx - s * 0.1, cy);
  p.fill(color);
  p.rect(cx - s * 0.3, cy + s * 0.24, s * 0.4, s * 0.08, 2);
}

function drawMine(p, cx, cy, s, color) {
  p.stroke(color);
  p.strokeWeight(Math.max(1.5, s * 0.07));
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    p.line(cx - Math.cos(a) * s * 0.32, cy - Math.sin(a) * s * 0.32, cx + Math.cos(a) * s * 0.32, cy + Math.sin(a) * s * 0.32);
  }
  p.noStroke();
  p.fill(color);
  p.circle(cx, cy, s * 0.46);
  p.fill(255, 255, 255, 200);
  p.circle(cx - s * 0.08, cy - s * 0.08, s * 0.1);
}

export function drawMinesweeper(p, geo, game, colors, dark) {
  const { cell, transposed } = geo;
  const numColors = dark ? NUMBER_COLORS_DARK : NUMBER_COLORS_LIGHT;
  const over = game.status === 'won' || game.status === 'lost';
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(cell * 0.58);

  for (let i = 0; i < game.cols * game.rows; i++) {
    const r = Math.floor(i / game.cols), c = i % game.cols;
    const x = (transposed ? r : c) * cell;
    const y = (transposed ? c : r) * cell;
    const cx = x + cell / 2, cy = y + cell / 2;
    const isMine = game.mineAt && game.mineAt[i];
    const open = game.revealed[i] || (game.status === 'lost' && isMine && !game.flagged[i]);

    if (open) {
      p.noStroke();
      p.fill(i === game.exploded ? colors.danger : colors['mine-open']);
      p.rect(x, y, cell, cell);
      p.stroke(colors['grid-line']);
      p.strokeWeight(1);
      p.noFill();
      p.rect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      if (isMine) drawMine(p, cx, cy, cell, i === game.exploded ? '#fff' : colors.text);
      else if (game.counts[i]) {
        p.noStroke();
        p.fill(numColors[game.counts[i]]);
        p.text(game.counts[i], cx, cy + cell * 0.03);
      }
    } else {
      // Ô chưa mở: hiệu ứng nổi nhẹ.
      p.noStroke();
      p.fill(colors['mine-hidden-edge']);
      p.rect(x + 1, y + 1, cell - 2, cell - 2, Math.min(5, cell * 0.15));
      p.fill(colors['mine-hidden']);
      p.rect(x + 1, y + 1, cell - 2, cell - 2 - Math.max(2, cell * 0.08), Math.min(5, cell * 0.15));
      if (game.flagged[i]) {
        drawFlag(p, cx, cy, cell, colors.text);
        if (game.status === 'lost' && !isMine) {
          // Cờ cắm sai sau khi thua.
          p.stroke(colors.danger);
          p.strokeWeight(Math.max(2, cell * 0.08));
          p.line(x + cell * 0.2, y + cell * 0.2, x + cell * 0.8, y + cell * 0.8);
          p.line(x + cell * 0.8, y + cell * 0.2, x + cell * 0.2, y + cell * 0.8);
        }
      }
    }
  }
  if (over) {
    p.noFill();
    p.stroke(game.status === 'won' ? colors.success : colors.danger);
    p.strokeWeight(3);
    p.rect(1.5, 1.5, p.width - 3, p.height - 3, 6);
  }
  p.textStyle(p.NORMAL);
}
