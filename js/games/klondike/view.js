// Bố cục bàn Klondike: hàng trên (bài rút, đã rút, 4 chồng đích) và 7 cột.
import { columnMetrics, fanColumn, stackPile } from '../../cards/layout.js';
import { TABLEAU, FOUNDATIONS } from './logic.js';

export function klondikeScene(state, availW, availH) {
  const m = columnMetrics(availW, availH, 7, { maxCardW: 104 });
  const { cardW, cardH, gap } = m;
  const y0 = m.margin;
  const y1 = y0 + cardH + Math.max(gap * 1.6, 8);
  const height = availH;
  const { piles, up } = state;
  const cards = [], slots = [], zones = [];
  const zoneCard = (pile, x, y) => zones.push({ pile, x: x - gap / 2, y: y - gap / 2, w: cardW + gap, h: cardH + gap });

  // Chồng bài rút: biểu tượng ↻ khi đã hết và còn bài để quay vòng.
  const sx = m.x(0);
  slots.push({ pile: 'stock', x: sx, y: y0, label: piles.waste.length ? '↻' : '' });
  cards.push(...stackPile(piles.stock, up, 'stock', sx, y0));
  zoneCard('stock', sx, y0);

  // Chồng đã rút: chế độ ba lá xòe tối đa 3 lá trên cùng (chỉ lá trên cùng dùng được).
  const wx = m.x(1);
  const w = piles.waste;
  const shown = state.options.draw === 3 ? Math.min(3, w.length) : 1;
  const step = Math.min(cardW * 0.34, (m.x(3) - m.x(1) - cardW - gap) / 2);
  w.forEach((id, i) => {
    const k = Math.max(0, i - (w.length - shown));
    cards.push({ id, x: wx + k * step, y: y0, up: true, pile: 'waste', index: i });
  });
  slots.push({ pile: 'waste', x: wx, y: y0 });
  zones.push({ pile: 'waste', x: wx - gap / 2, y: y0 - gap / 2, w: cardW + 2 * step + gap, h: cardH + gap });

  FOUNDATIONS.forEach((f, i) => {
    const x = m.x(3 + i);
    slots.push({ pile: f, x, y: y0, label: 'A' });
    cards.push(...stackPile(piles[f], up, f, x, y0));
    zoneCard(f, x, y0);
  });

  let bottom = 0;
  TABLEAU.forEach((t, i) => {
    const x = m.x(i);
    slots.push({ pile: t, x, y: y1, label: 'K' });
    const col = fanColumn(piles[t], up, t, x, y1, cardH, height - m.margin);
    cards.push(...col.cards);
    bottom = Math.max(bottom, col.bottom + m.margin);
  });
  // Cột rất dài trên màn hình thấp: bàn cao thêm thay vì che mất dải hạng + chất.
  const h = Math.max(height, bottom);
  TABLEAU.forEach((t, i) => zones.push({ pile: t, x: m.x(i) - gap / 2, y: y1 - gap / 2, w: cardW + gap, h: h - y1 + gap / 2 }));

  return { width: m.width, height: h, cardW, cardH, slots, cards, zones, origin: { x: sx, y: y0 } };
}
