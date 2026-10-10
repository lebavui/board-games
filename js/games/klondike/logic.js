// Luật Klondike (Solitaire) — thuần dữ liệu, không DOM, không p5.
// Chồng bài: stock (bài rút, úp), waste (đã rút, ngửa), f0–f3 (đích), t0–t6 (cột).
import { createDeck, createRng, shuffle, cardOf, isRed, deal, top, cloneState, RANK_LABELS, SUIT_SYMBOLS } from '../../cards/deck.js';

export const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6'];
export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
const DECK_IDS = createDeck().map((c) => c.id);

export function normalizeOptions(options) {
  return { draw: options?.draw === 3 ? 3 : 1 };
}

export const expectedIds = () => DECK_IDS;

export function newGame(seed, options) {
  const opts = normalizeOptions(options);
  const stock = shuffle(DECK_IDS, createRng(seed));
  const piles = { stock, waste: [] };
  for (const f of FOUNDATIONS) piles[f] = [];
  for (const t of TABLEAU) piles[t] = [];
  const up = {};
  // Chia từng hàng từ trái sang phải: cột i nhận i + 1 lá, chỉ lá trên cùng ngửa.
  for (let row = 0; row < 7; row++) {
    for (let col = row; col < 7; col++) piles[TABLEAU[col]].push(...deal(stock, 1));
  }
  for (const t of TABLEAU) up[top(piles[t])] = true;
  return { seed, options: opts, piles, up, moves: 0, passes: 0 };
}

const isTableau = (pile) => /^t[0-6]$/.test(pile);
const isFoundation = (pile) => /^f[0-3]$/.test(pile);

/** Dãy từ `index` tới cuối cột: toàn bộ ngửa, giảm dần 1 hạng, xen kẽ màu. */
export function isAlternatingRun(state, ids) {
  for (let i = 0; i < ids.length; i++) {
    if (!state.up[ids[i]]) return false;
    if (i === 0) continue;
    const a = cardOf(ids[i - 1]), b = cardOf(ids[i]);
    if (b.rank !== a.rank - 1 || isRed(a.suit) === isRed(b.suit)) return false;
  }
  return true;
}

/** Có thể cầm lá ở vị trí `index` của chồng `pile` (cùng các lá phía trên nó) không. */
export function canPick(state, pile, index) {
  const cards = state.piles[pile];
  if (!cards || index < 0 || index >= cards.length) return false;
  if (pile === 'waste' || isFoundation(pile)) return index === cards.length - 1;
  if (isTableau(pile)) return isAlternatingRun(state, cards.slice(index));
  return false;
}

/** Có thể đặt các lá `ids` (dưới → trên) lên chồng `to` không. */
export function canPlace(state, ids, to) {
  const first = cardOf(ids[0]);
  const dest = state.piles[to];
  if (!first || !dest) return false;
  const t = dest.length ? cardOf(top(dest)) : null;
  if (isFoundation(to)) {
    if (ids.length !== 1) return false;
    return t ? t.suit === first.suit && first.rank === t.rank + 1 : first.rank === 1;
  }
  if (isTableau(to)) {
    if (!t) return first.rank === 13;
    return state.up[top(dest)] && first.rank === t.rank - 1 && isRed(first.suit) !== isRed(t.suit);
  }
  return false;
}

/** Thử nước đi { from, index, to }; trả về trạng thái mới hoặc null nếu không hợp lệ. */
export function tryMove(state, { from, index, to }) {
  if (from === to || !canPick(state, from, index)) return null;
  const ids = state.piles[from].slice(index);
  if (!canPlace(state, ids, to)) return null;
  const next = cloneState(state);
  next.piles[to].push(...next.piles[from].splice(index));
  // Tự lật lá úp vừa lộ ra trên cột.
  const src = next.piles[from];
  if (isTableau(from) && src.length && !next.up[top(src)]) next.up[top(src)] = true;
  next.moves++;
  return next;
}

/** Chạm chồng bài rút: rút 1 hoặc 3 lá, hoặc quay vòng chồng đã rút khi chồng rút đã hết (không giới hạn). */
export function drawStock(state) {
  const { stock, waste } = state.piles;
  if (!stock.length && !waste.length) return null;
  const next = cloneState(state);
  const s = next.piles.stock, w = next.piles.waste;
  if (s.length) {
    const n = Math.min(next.options.draw, s.length);
    for (let i = 0; i < n; i++) {
      const id = s.pop();
      next.up[id] = true;
      w.push(id);
    }
  } else {
    while (w.length) {
      const id = w.pop();
      delete next.up[id];
      s.push(id);
    }
    next.passes++;
  }
  next.moves++;
  return next;
}

export const isWon = (state) => FOUNDATIONS.reduce((n, f) => n + state.piles[f].length, 0) === 52;

/** Chồng đích nhận được lá `id` (ưu tiên chồng cùng chất, sau đó chồng trống đầu tiên). */
export function foundationFor(state, id) {
  return FOUNDATIONS.find((f) => canPlace(state, [id], f)) || null;
}

/** Đích tự động khi chạm hai lần: chồng đích trước, sau đó cột phù hợp. */
export function autoTarget(state, pile, index) {
  if (!canPick(state, pile, index)) return null;
  const ids = state.piles[pile].slice(index);
  if (ids.length === 1 && !isFoundation(pile)) {
    const f = foundationFor(state, ids[0]);
    if (f) return f;
  }
  const targets = TABLEAU.filter((t) => t !== pile && canPlace(state, ids, t));
  // Không chuyển K đang nằm đáy cột sang cột trống khác (vô ích).
  const useful = targets.filter((t) => !(state.piles[t].length === 0 && isTableau(pile) && index === 0));
  return useful.find((t) => state.piles[t].length) || useful[0] || null;
}

/** Có thể tự hoàn tất: không còn bài rút/đã rút và mọi lá trên cột đều ngửa. */
export function canAutoFinish(state) {
  if (state.piles.stock.length || state.piles.waste.length || isWon(state)) return false;
  return TABLEAU.every((t) => state.piles[t].every((id) => state.up[id]));
}

/** Nước tiếp theo khi tự hoàn tất: lá trên cùng có hạng nhỏ nhất đưa lên đích. */
export function nextFinishMove(state) {
  let best = null;
  for (const t of TABLEAU) {
    const cards = state.piles[t];
    if (!cards.length) continue;
    const f = foundationFor(state, top(cards));
    if (f && (!best || cardOf(top(cards)).rank < best.rank)) best = { from: t, index: cards.length - 1, to: f, rank: cardOf(top(cards)).rank };
  }
  return best && { from: best.from, index: best.index, to: best.to };
}

const name = (id) => `${RANK_LABELS[cardOf(id).rank]}${SUIT_SYMBOLS[cardOf(id).suit]}︎`;
const pileName = (p) => (isFoundation(p) ? 'chồng đích' : isTableau(p) ? `cột ${Number(p[1]) + 1}` : p === 'waste' ? 'bài đã rút' : p);

/**
 * Gợi ý MỘT nước đi hợp lệ theo thứ tự ưu tiên đơn giản (không phải bộ giải, không bảo đảm tối ưu).
 * Trả về { move, text } với move = { from, index, to } hoặc { draw: true }; null nếu không thấy nước có ích.
 */
export function hint(state) {
  const moves = [];
  const add = (move, priority) => {
    const ids = state.piles[move.from].slice(move.index);
    moves.push({ move, priority, text: `Chuyển ${name(ids[0])}${ids.length > 1 ? ` (${ids.length} lá)` : ''} từ ${pileName(move.from)} sang ${pileName(move.to)}` });
  };
  const sources = [...TABLEAU, 'waste'];
  for (const from of sources) {
    const cards = state.piles[from];
    if (!cards.length) continue;
    const t = cards.length - 1;
    const f = foundationFor(state, cards[t]);
    if (f) add({ from, index: t, to: f }, from === 'waste' ? 9 : 10);
  }
  for (const from of TABLEAU) {
    const cards = state.piles[from];
    for (let i = 0; i < cards.length; i++) {
      if (!canPick(state, from, i)) continue;
      for (const to of TABLEAU) {
        if (to === from || !canPlace(state, cards.slice(i), to)) continue;
        if (i === 0 && !state.piles[to].length) continue; // chuyển cả cột sang cột trống: vô ích
        if (i > 0 && !state.up[cards[i - 1]]) add({ from, index: i, to }, 8); // lật được lá úp
        else if (i === 0) add({ from, index: i, to }, 7); // làm trống một cột
        else if (foundationFor(state, cards[i - 1])) add({ from, index: i, to }, 6); // lộ lá lên được đích
      }
    }
  }
  const w = state.piles.waste;
  if (w.length) {
    for (const to of TABLEAU) if (canPlace(state, [top(w)], to)) add({ from: 'waste', index: w.length - 1, to }, 5);
  }
  if (moves.length) {
    moves.sort((a, b) => b.priority - a.priority);
    return { move: moves[0].move, text: moves[0].text };
  }
  // Rút bài chỉ có ích nếu còn lá nào trong chồng rút/đã rút đặt được ở đâu đó.
  const pool = [...state.piles.stock, ...state.piles.waste];
  const playable = pool.some((id) => foundationFor(state, id) || TABLEAU.some((t) => canPlace({ ...state, up: { ...state.up, [id]: true } }, [id], t)));
  if (playable) {
    return { move: { draw: true }, text: state.piles.stock.length ? 'Rút bài từ chồng bài rút' : 'Quay vòng chồng bài đã rút rồi rút tiếp' };
  }
  return null;
}
