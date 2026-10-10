// Tính bố cục bàn bài dạng cột (Klondike, FreeCell, Spider) — thuần toán học, không p5.
import { CARD_RATIO, INDEX_STRIP } from './card-render.js';

/**
 * Kích thước lá và vị trí cột cho `cols` cột vừa với khung `availW` × `availH`.
 * `rowsOfCards`: số lá cao tối thiểu cần chứa theo chiều dọc (hàng trên + cột xòe) để giới hạn lá trên màn hình thấp.
 */
export function columnMetrics(availW, availH, cols, { maxCardW = 100, gapRatio = 0.1, rowsOfCards = 3.3 } = {}) {
  const margin = availW < 480 ? 4 : 10;
  let cardW = (availW - 2 * margin) / (cols + (cols - 1) * gapRatio);
  cardW = Math.min(cardW, maxCardW, (availH - 2 * margin) / (rowsOfCards * CARD_RATIO));
  cardW = Math.max(26, Math.floor(cardW));
  const cardH = Math.round(cardW * CARD_RATIO);
  const gap = Math.max(3, Math.floor(cardW * gapRatio));
  const totalW = cols * cardW + (cols - 1) * gap;
  const left = Math.max(margin, Math.floor((availW - totalW) / 2));
  return { cardW, cardH, gap, margin, left, width: Math.max(availW, totalW + 2 * margin), x: (col) => left + col * (cardW + gap) };
}

/**
 * Xòe một cột bài theo chiều dọc. Lá úp chiếm bước nhỏ, lá ngửa chiếm bước đủ để lộ dải hạng + chất.
 * Nếu cột quá dài so với `maxBottom`, các bước được nén nhưng không nhỏ hơn dải chỉ số (vẫn đọc được).
 */
export function fanColumn(ids, up, pile, x, y, cardH, maxBottom) {
  const n = ids.length;
  if (!n) return { cards: [], bottom: y + cardH };
  let down = cardH * 0.13, open = cardH * 0.34;
  const minDown = cardH * 0.06, minOpen = cardH * INDEX_STRIP + 2;
  const downCount = ids.slice(0, -1).filter((id) => !up[id]).length;
  const openCount = n - 1 - downCount;
  const need = () => downCount * down + openCount * open + cardH;
  const room = maxBottom - y;
  if (need() > room && downCount) down = Math.max(minDown, (room - cardH - openCount * open) / downCount);
  if (need() > room && openCount) open = Math.max(minOpen, (room - cardH - downCount * down) / openCount);
  const cards = [];
  let cy = y;
  for (let i = 0; i < n; i++) {
    cards.push({ id: ids[i], x, y: cy, up: !!up[ids[i]], pile, index: i });
    if (i < n - 1) cy += up[ids[i]] ? open : down;
  }
  return { cards, bottom: cy + cardH };
}

/** Một chồng gọn (mọi lá trùng vị trí), ví dụ chồng đích hay chồng bài rút. */
export function stackPile(ids, up, pile, x, y) {
  return ids.map((id, index) => ({ id, x, y, up: !!up[id], pile, index }));
}
