// Vẽ bàn Kakuro bằng p5.js.
export const COLOR_NAMES = [
  'cell', 'cell-related', 'cell-selected', 'grid-line', 'block', 'block-text',
  'user-digit', 'note', 'error', 'error-bg', 'hint', 'success', 'accent',
];

const MIN_CELL = 30;

export function layout(model, availWidth, availHeight) {
  // Bàn lớn trên màn hình hẹp: giữ ô tối thiểu MIN_CELL px, khung bàn cuộn ngang thay vì thu ô quá nhỏ.
  const cell = Math.max(Math.min(availWidth / model.width, availHeight / model.height, 72), MIN_CELL);
  return { width: cell * model.width, height: cell * model.height };
}

export function hitTest(model, x, y, width) {
  const cell = width / model.width;
  const c = Math.floor(x / cell), r = Math.floor(y / cell);
  if (r < 0 || c < 0 || r >= model.height || c >= model.width) return null;
  return [r, c];
}

/**
 * view: { model, values, notes, selected:[r,c]|null, conflicts:Set, runState, wrong:Set, hinted:Set, won }
 */
export function drawKakuro(p, width, height, view, colors) {
  const { model } = view;
  const cell = width / model.width;
  const sel = view.selected;
  const selCell = sel ? model.cells[sel[0]][sel[1]] : null;
  const activeRuns = new Set(selCell && selCell.type === 'white' ? [selCell.hRun, selCell.vRun] : []);

  p.background(colors.block);
  for (let r = 0; r < model.height; r++) {
    for (let c = 0; c < model.width; c++) {
      const x = c * cell, y = r * cell;
      const data = model.cells[r][c];
      const key = `${r},${c}`;
      if (data.type === 'white') {
        let bg = colors.cell;
        if (!view.won && (activeRuns.has(data.hRun) || activeRuns.has(data.vRun))) bg = colors['cell-related'];
        if (!view.won && (view.conflicts.has(key) || view.wrong.has(key))) bg = colors['error-bg'];
        if (!view.won && sel && sel[0] === r && sel[1] === c) bg = colors['cell-selected'];
        p.noStroke();
        p.fill(bg);
        p.rect(x + 1, y + 1, cell - 2, cell - 2, 3);

        const v = view.values[r][c];
        p.textAlign(p.CENTER, p.CENTER);
        if (v) {
          let color = view.hinted.has(key) ? colors.hint : colors['user-digit'];
          if (view.conflicts.has(key) || view.wrong.has(key)) color = colors.error;
          if (view.won) color = colors.success;
          p.fill(color);
          p.textStyle(p.BOLD);
          p.textSize(cell * 0.55);
          p.text(v, x + cell / 2, y + cell / 2 + cell * 0.03);
          p.textStyle(p.NORMAL);
        } else if (view.notes[r][c]) {
          p.fill(colors.note);
          p.textSize(cell * 0.22);
          const sub = (cell - 4) / 3;
          for (let d = 1; d <= 9; d++) {
            if (!(view.notes[r][c] & (1 << d))) continue;
            p.text(d, x + 2 + ((d - 1) % 3) * sub + sub / 2, y + 2 + Math.floor((d - 1) / 3) * sub + sub / 2 + 1);
          }
        }
      } else if (data.type === 'clue') {
        // Ô gợi ý: đường chéo, tổng dọc ở góc dưới-trái, tổng ngang ở góc trên-phải.
        p.stroke(colors['block-text']);
        p.strokeWeight(1);
        p.drawingContext.globalAlpha = 0.45;
        p.line(x + 2, y + 2, x + cell - 2, y + cell - 2);
        p.drawingContext.globalAlpha = 1;
        p.noStroke();
        p.textStyle(p.BOLD);
        p.textSize(cell * 0.3);
        const runColor = (dir) => {
          const idx = model.runs.findIndex((run) => run.dir === dir && run.clue[0] === r && run.clue[1] === c);
          const state = view.runState[idx];
          if (state && (state.wrongSum || (state.full && !state.satisfied))) return colors.error;
          if (state && state.satisfied) return colors.success;
          if (activeRuns.has(idx)) return colors.accent;
          return colors['block-text'];
        };
        if (data.right) {
          p.fill(runColor('right'));
          p.textAlign(p.RIGHT, p.TOP);
          p.text(data.right, x + cell - cell * 0.1, y + cell * 0.1);
        }
        if (data.down) {
          p.fill(runColor('down'));
          p.textAlign(p.LEFT, p.BOTTOM);
          p.text(data.down, x + cell * 0.1, y + cell - cell * 0.06);
        }
        p.textStyle(p.NORMAL);
      }
    }
  }
}
