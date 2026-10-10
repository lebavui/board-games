// Bố cục bàn FreeCell: hàng trên (4 ô dự trữ, 4 chồng đích) và 8 cột.
import { columnMetrics, fanColumn, stackPile } from '../../cards/layout.js';
import { CELLS, FOUNDATIONS, TABLEAU } from './logic.js';

export function freecellScene(state, availW, availH) {
  const m = columnMetrics(availW, availH, 8, { maxCardW: 96, rowsOfCards: 3.6 });
  const { cardW, cardH, gap } = m;
  const y0 = m.margin;
  const y1 = y0 + cardH + Math.max(gap * 1.6, 8);
  const { piles, up } = state;
  const cards = [], slots = [], zones = [];

  [...CELLS, ...FOUNDATIONS].forEach((p, i) => {
    const x = m.x(i);
    slots.push({ pile: p, x, y: y0, label: i < 4 ? '' : 'A' });
    cards.push(...stackPile(piles[p], up, p, x, y0));
    zones.push({ pile: p, x: x - gap / 2, y: y0 - gap / 2, w: cardW + gap, h: cardH + gap });
  });

  let bottom = 0;
  TABLEAU.forEach((t, i) => {
    const x = m.x(i);
    slots.push({ pile: t, x, y: y1 });
    const col = fanColumn(piles[t], up, t, x, y1, cardH, availH - m.margin);
    cards.push(...col.cards);
    bottom = Math.max(bottom, col.bottom + m.margin);
  });
  const height = Math.max(availH, bottom);
  TABLEAU.forEach((t, i) => zones.push({ pile: t, x: m.x(i) - gap / 2, y: y1 - gap / 2, w: cardW + gap, h: height - y1 + gap / 2 }));

  return { width: m.width, height, cardW, cardH, slots, cards, zones, origin: { x: m.x(0), y: y0 } };
}
