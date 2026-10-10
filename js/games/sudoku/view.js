// Vẽ bàn Sudoku bằng p5.js. Chỉ đọc trạng thái, không thay đổi luật chơi.
import { ROW, COL, BOX } from './logic.js';

export const COLOR_NAMES = [
  'cell', 'cell-related', 'cell-same', 'cell-selected', 'grid-line', 'grid-strong',
  'given', 'user-digit', 'note', 'error', 'error-bg', 'hint', 'success',
];

const PAD = 2;

export function layout(availWidth, availHeight) {
  const side = Math.min(availWidth, availHeight, 600);
  return { width: side, height: side };
}

export function hitTest(x, y, width) {
  const cell = (width - PAD * 2) / 9;
  const c = Math.floor((x - PAD) / cell);
  const r = Math.floor((y - PAD) / cell);
  if (r < 0 || c < 0 || r > 8 || c > 8) return -1;
  return r * 9 + c;
}

/**
 * view: { puzzle, values, notes, selected, wrong:Set, hinted:Set, conflicts:Set, won, highlightSame }
 */
export function drawSudoku(p, width, height, view, colors) {
  const cell = (width - PAD * 2) / 9;
  const sel = view.selected;
  const selValue = sel >= 0 ? view.values[sel] : 0;

  p.noStroke();
  p.fill(colors.cell);
  p.rect(0, 0, width, height, 8);

  for (let i = 0; i < 81; i++) {
    const x = PAD + COL(i) * cell, y = PAD + ROW(i) * cell;
    let bg = null;
    if (view.won) bg = colors['cell-related'];
    else if (sel >= 0) {
      if (i === sel) bg = colors['cell-selected'];
      else if (view.highlightSame && selValue && view.values[i] === selValue) bg = colors['cell-same'];
      else if (ROW(i) === ROW(sel) || COL(i) === COL(sel) || BOX(i) === BOX(sel)) bg = colors['cell-related'];
    }
    if (!view.won && view.values[i] && (view.conflicts.has(i) || view.wrong.has(i)) && i !== sel) bg = colors['error-bg'];
    if (bg) { p.fill(bg); p.rect(x, y, cell, cell); }
  }

  // Lưới: đường mảnh cho ô, đường đậm cho vùng 3×3.
  p.stroke(colors['grid-line']);
  p.strokeWeight(1);
  for (let k = 1; k < 9; k++) {
    if (k % 3 === 0) continue;
    p.line(PAD + k * cell, PAD, PAD + k * cell, PAD + 9 * cell);
    p.line(PAD, PAD + k * cell, PAD + 9 * cell, PAD + k * cell);
  }
  p.stroke(colors['grid-strong']);
  p.strokeWeight(Math.max(2, cell * 0.045));
  for (let k = 3; k < 9; k += 3) {
    p.line(PAD + k * cell, PAD, PAD + k * cell, PAD + 9 * cell);
    p.line(PAD, PAD + k * cell, PAD + 9 * cell, PAD + k * cell);
  }
  p.noFill();
  p.rect(PAD, PAD, cell * 9, cell * 9, 6);

  // Chữ số
  p.noStroke();
  p.textAlign(p.CENTER, p.CENTER);
  for (let i = 0; i < 81; i++) {
    const x = PAD + COL(i) * cell, y = PAD + ROW(i) * cell;
    const v = view.values[i];
    if (v) {
      const given = view.puzzle[i] !== 0;
      let color = given ? colors.given : colors['user-digit'];
      if (!given && view.hinted.has(i)) color = colors.hint;
      if (!given && (view.wrong.has(i) || view.conflicts.has(i))) color = colors.error;
      if (view.won) color = given ? colors.given : colors.success;
      p.fill(color);
      p.textStyle(given ? p.BOLD : p.NORMAL);
      p.textSize(cell * 0.6);
      p.text(v, x + cell / 2, y + cell / 2 + cell * 0.04);
    } else if (view.notes[i]) {
      p.fill(colors.note);
      p.textStyle(p.NORMAL);
      p.textSize(cell * 0.24);
      const sub = cell / 3;
      for (let d = 1; d <= 9; d++) {
        if (!(view.notes[i] & (1 << d))) continue;
        const nx = x + ((d - 1) % 3) * sub + sub / 2;
        const ny = y + Math.floor((d - 1) / 3) * sub + sub / 2;
        if (selValue === d && view.highlightSame) {
          p.fill(colors['cell-selected']);
          p.circle(nx, ny, sub * 0.85);
          p.fill(colors.given);
        }
        p.text(d, nx, ny + 1);
        p.fill(colors.note);
      }
    }
  }
  p.textStyle(p.NORMAL);
}
