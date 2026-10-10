// Luật Spider Solitaire — thuần dữ liệu, không DOM, không p5.
// 104 lá (tương đương hai bộ). Chồng bài: stock (bài chia thêm), done (các chuỗi K–A đã thu), t0–t9 (cột).
import { createDeck, createRng, shuffle, cardOf, deal, top, cloneState, RANK_LABELS, SUIT_SYMBOLS } from '../../cards/deck.js';

export const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'];
export const SUIT_SETS = { 1: ['S'], 2: ['S', 'H'], 4: ['S', 'H', 'D', 'C'] };

export function normalizeOptions(options) {
  const suits = Number(options?.suits);
  return { suits: SUIT_SETS[suits] ? suits : 1 };
}

const idCache = {};
/** 104 ID: một chất = 8 bộ chỉ có ♠; hai chất = 4 bộ ♠♥; bốn chất = 2 bộ đầy đủ. */
export function expectedIds(options) {
  const { suits } = normalizeOptions(options);
  if (!idCache[suits]) idCache[suits] = createDeck({ decks: 8 / suits, suits: SUIT_SETS[suits] }).map((c) => c.id);
  return idCache[suits];
}

export function newGame(seed, options) {
  const opts = normalizeOptions(options);
  const stock = shuffle(expectedIds(opts), createRng(seed));
  const piles = { stock, done: [] };
  for (const t of TABLEAU) piles[t] = [];
  // 54 lá chia lần lượt vào 10 cột: bốn cột đầu 6 lá, sáu cột sau 5 lá; còn 50 lá để chia thêm 5 lần.
  for (let k = 0; k < 54; k++) piles[TABLEAU[k % 10]].push(...deal(stock, 1));
  const up = {};
  for (const t of TABLEAU) up[top(piles[t])] = true;
  return { seed, options: opts, piles, up, moves: 0 };
}

const isTableau = (p) => /^t\d$/.test(p);

/** Chuỗi di chuyển được: tất cả ngửa, giảm dần 1 hạng, cùng chất. */
export function isSuitedRun(state, ids) {
  for (let i = 0; i < ids.length; i++) {
    if (!state.up[ids[i]]) return false;
    if (i === 0) continue;
    const a = cardOf(ids[i - 1]), b = cardOf(ids[i]);
    if (b.rank !== a.rank - 1 || b.suit !== a.suit) return false;
  }
  return true;
}

export function canPick(state, pile, index) {
  const cards = state.piles[pile];
  if (!isTableau(pile) || !cards || index < 0 || index >= cards.length) return false;
  return isSuitedRun(state, cards.slice(index));
}

/** Đặt lên lá lớn hơn đúng 1 hạng, bất kể chất; cột trống nhận một lá hoặc chuỗi hợp lệ. */
export function canPlace(state, ids, to) {
  const dest = state.piles[to];
  if (!isTableau(to) || !dest) return false;
  if (!dest.length) return true;
  return state.up[top(dest)] && cardOf(top(dest)).rank === cardOf(ids[0]).rank + 1;
}

function flipTop(state, pile) {
  const p = state.piles[pile];
  if (p.length && !state.up[top(p)]) state.up[top(p)] = true;
}

/** Thu chuỗi K → A cùng chất nằm ở cuối cột (lặp cho mọi cột). Sửa trực tiếp `state`. */
export function collectRuns(state) {
  let collected = 0;
  for (const t of TABLEAU) {
    const p = state.piles[t];
    if (p.length < 13) continue;
    const tail = p.slice(-13);
    if (cardOf(tail[0]).rank === 13 && isSuitedRun(state, tail)) {
      state.piles.done.push(...p.splice(p.length - 13, 13));
      flipTop(state, t);
      collected++;
    }
  }
  return collected;
}

export function tryMove(state, { from, index, to }) {
  if (from === to || !canPick(state, from, index)) return null;
  const ids = state.piles[from].slice(index);
  if (!canPlace(state, ids, to)) return null;
  const next = cloneState(state);
  next.piles[to].push(...next.piles[from].splice(index));
  flipTop(next, from);
  collectRuns(next);
  next.moves++;
  return next;
}

/** Chia thêm: mỗi cột một lá ngửa. Trả về trạng thái mới, chuỗi lỗi (còn cột trống) hoặc null (hết bài). */
export function dealRow(state) {
  if (state.piles.stock.length < TABLEAU.length) return null;
  if (TABLEAU.some((t) => !state.piles[t].length)) return 'Không thể chia thêm khi còn cột trống';
  const next = cloneState(state);
  for (const t of TABLEAU) {
    const id = next.piles.stock.pop();
    next.up[id] = true;
    next.piles[t].push(id);
  }
  collectRuns(next);
  next.moves++;
  return next;
}

export const completedRuns = (state) => state.piles.done.length / 13;
export const isWon = (state) => state.piles.done.length === 104;

export function autoTarget(state, pile, index) {
  if (!canPick(state, pile, index)) return null;
  const ids = state.piles[pile].slice(index);
  const first = cardOf(ids[0]);
  const fits = TABLEAU.filter((t) => t !== pile && canPlace(state, ids, t));
  return fits.find((t) => state.piles[t].length && cardOf(top(state.piles[t])).suit === first.suit)
    || fits.find((t) => state.piles[t].length)
    || (index > 0 ? fits[0] : null)
    || null;
}

const name = (id) => `${RANK_LABELS[cardOf(id).rank]}${SUIT_SYMBOLS[cardOf(id).suit]}︎`;
const colName = (p) => `cột ${Number(p.slice(1)) + 1}`;

/** Gợi ý MỘT nước đi hợp lệ theo thứ tự ưu tiên đơn giản (không phải bộ giải, không bảo đảm tối ưu). */
export function hint(state) {
  let best = null;
  let fallback = null; // nước hợp lệ nhưng ít giá trị, chỉ dùng khi phải lấp cột trống trước khi chia
  for (const from of TABLEAU) {
    const cards = state.piles[from];
    for (let i = 0; i < cards.length; i++) {
      if (!canPick(state, from, i)) continue;
      const ids = cards.slice(i);
      const first = cardOf(ids[0]);
      const below = i > 0 ? cards[i - 1] : null;
      const belowFits = below && state.up[below] && cardOf(below).rank === first.rank + 1;
      const belowSameSuit = belowFits && cardOf(below).suit === first.suit;
      for (const to of TABLEAU) {
        if (to === from || !canPlace(state, ids, to)) continue;
        const dest = state.piles[to];
        const move = { from, index: i, to };
        let pr;
        if (!dest.length) {
          if (i === 0) continue; // cả cột sang cột trống: vô ích
          if (belowFits) { fallback = fallback || move; continue; }
          pr = below && !state.up[below] ? 4 : 1;
        } else {
          const sameSuit = cardOf(top(dest)).suit === first.suit;
          if (belowSameSuit || (belowFits && !sameSuit)) continue; // đã nằm ở vị trí tương đương
          pr = sameSuit ? 6 : 3;
          if (i === 0) pr += 3;
          else if (!state.up[below]) pr += 2;
          pr += ids.length * 0.01;
        }
        if (!best || pr > best.pr) best = { pr, move, ids };
      }
    }
  }
  if (best) {
    const { move, ids } = best;
    return { move, text: `Chuyển ${name(ids[0])}${ids.length > 1 ? ` (${ids.length} lá)` : ''} từ ${colName(move.from)} sang ${colName(move.to)}` };
  }
  const hasEmpty = TABLEAU.some((t) => !state.piles[t].length);
  if (state.piles.stock.length >= 10 && !hasEmpty) return { move: { draw: true }, text: 'Chia thêm một hàng bài' };
  if (state.piles.stock.length >= 10 && fallback) {
    const ids = state.piles[fallback.from].slice(fallback.index);
    return { move: fallback, text: `Lấp cột trống trước khi chia: chuyển ${name(ids[0])} từ ${colName(fallback.from)} sang ${colName(fallback.to)}` };
  }
  return null;
}
