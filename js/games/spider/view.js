// Bố cục bàn Spider: hàng trên (các chuỗi đã thu bên trái, bài chia thêm bên phải) và 10 cột.
import { columnMetrics, fanColumn } from '../../cards/layout.js';
import { TABLEAU } from './logic.js';

export function spiderScene(state, availW, availH) {
  const m = columnMetrics(availW, availH, 10, { maxCardW: 90, rowsOfCards: 4 });
  const { cardW, cardH, gap } = m;
  const y0 = m.margin;
  const y1 = y0 + cardH + Math.max(gap * 1.6, 8);
  const { piles, up } = state;
  const cards = [], slots = [], zones = [];

  // Chuỗi đã thu: mỗi chuỗi là một chồng, lá K nằm trên cùng để thấy chất.
  const step = Math.min(cardW * 0.42, (m.x(6) - m.x(0)) / 7);
  slots.push({ pile: 'done', x: m.x(0), y: y0, label: 'K' });
  const runs = piles.done.length / 13;
  for (let g = 0; g < runs; g++) {
    const group = piles.done.slice(g * 13, g * 13 + 13);
    for (let k = group.length - 1; k >= 0; k--) {
      cards.push({ id: group[k], x: m.x(0) + g * step, y: y0, up: true, pile: 'done', index: g * 13 + k });
    }
  }

  // Bài chia thêm: mỗi nhóm 10 lá là một lần chia, xếp lệch sang trái để đếm được số lần còn lại.
  const sx = m.x(9);
  const deals = Math.ceil(piles.stock.length / 10);
  const dStep = Math.min(cardW * 0.22, 14);
  slots.push({ pile: 'stock', x: sx, y: y0 });
  piles.stock.forEach((id, j) => {
    const g = Math.floor(j / 10);
    cards.push({ id, x: sx - (deals - 1 - g) * dStep, y: y0, up: false, pile: 'stock', index: j });
  });
  zones.push({ pile: 'stock', x: sx - Math.max(0, deals - 1) * dStep - gap / 2, y: y0 - gap / 2, w: cardW + Math.max(0, deals - 1) * dStep + gap, h: cardH + gap });

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

  return { width: m.width, height, cardW, cardH, slots, cards, zones, origin: { x: sx, y: y0 } };
}
