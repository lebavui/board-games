// Luật FreeCell — thuần dữ liệu, không DOM, không p5.
// Chồng bài: c0–c3 (ô dự trữ, mỗi ô tối đa 1 lá), f0–f3 (đích), t0–t7 (cột). Mọi lá đều ngửa.
import { createDeck, createRng, shuffle, cardOf, isRed, top, cloneState, RANK_LABELS, SUIT_SYMBOLS } from '../../cards/deck.js';

export const CELLS = ['c0', 'c1', 'c2', 'c3'];
export const FOUNDATIONS = ['f0', 'f1', 'f2', 'f3'];
export const TABLEAU = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
const DECK_IDS = createDeck().map((c) => c.id);

export const normalizeOptions = () => ({});
export const expectedIds = () => DECK_IDS;

export function newGame(seed) {
  const order = shuffle(DECK_IDS, createRng(seed));
  const piles = {};
  for (const p of [...CELLS, ...FOUNDATIONS, ...TABLEAU]) piles[p] = [];
  // Chia ngửa lần lượt vào 8 cột: bốn cột đầu 7 lá, bốn cột sau 6 lá.
  order.forEach((id, i) => piles[TABLEAU[i % 8]].push(id));
  const up = Object.fromEntries(DECK_IDS.map((id) => [id, true]));
  return { seed, options: {}, piles, up, moves: 0 };
}

const isCell = (p) => /^c[0-3]$/.test(p);
const isFoundation = (p) => /^f[0-3]$/.test(p);
const isTableau = (p) => /^t[0-7]$/.test(p);

export function isAlternatingRun(ids) {
  for (let i = 1; i < ids.length; i++) {
    const a = cardOf(ids[i - 1]), b = cardOf(ids[i]);
    if (b.rank !== a.rank - 1 || isRed(a.suit) === isRed(b.suit)) return false;
  }
  return true;
}

export function canPick(state, pile, index) {
  const cards = state.piles[pile];
  if (!cards || index < 0 || index >= cards.length) return false;
  if (isCell(pile)) return index === cards.length - 1;
  if (isTableau(pile)) return isAlternatingRun(cards.slice(index));
  return false; // không lấy bài từ chồng đích
}

export function canPlace(state, ids, to) {
  const first = cardOf(ids[0]);
  const dest = state.piles[to];
  if (!first || !dest) return false;
  if (isCell(to)) return ids.length === 1 && dest.length === 0;
  const t = dest.length ? cardOf(top(dest)) : null;
  if (isFoundation(to)) {
    if (ids.length !== 1) return false;
    return t ? t.suit === first.suit && first.rank === t.rank + 1 : first.rank === 1;
  }
  if (isTableau(to)) return !t || (first.rank === t.rank - 1 && isRed(first.suit) !== isRed(t.suit));
  return false;
}

/**
 * Số lá tối đa chuyển được một lần tới `to`: (ô trống + 1) × 2^(cột trống dùng làm trung gian).
 * Nếu đích là cột trống, cột đó không được tính là trung gian.
 */
export function maxMovable(state, to) {
  const freeCells = CELLS.filter((c) => !state.piles[c].length).length;
  const emptyCols = TABLEAU.filter((t) => t !== to && !state.piles[t].length).length;
  return (freeCells + 1) * 2 ** emptyCols;
}

/**
 * Tách việc chuyển `count` lá trên cùng từ cột `from` sang `to` thành các bước chuyển TỪNG LÁ hợp lệ
 * (qua ô dự trữ và cột trống). Mỗi bước được kiểm tra bằng luật một lá. Trả về null nếu không làm được.
 */
export function supermoveSteps(state, from, count, to) {
  const sim = cloneState(state);
  const steps = [];
  const single = (a, b) => {
    const id = top(sim.piles[a]);
    if (!id || !canPlace(sim, [id], b)) throw new Error('bước không hợp lệ');
    sim.piles[b].push(sim.piles[a].pop());
    steps.push({ from: a, index: sim.piles[a].length, to: b });
  };
  const rec = (n, src, dst, cells, empties) => {
    if (n <= cells.length + 1) {
      const used = cells.slice(0, n - 1);
      for (const c of used) single(src, c);
      single(src, dst);
      for (const c of used.reverse()) single(c, dst);
      return;
    }
    if (!empties.length) throw new Error('không đủ chỗ trung gian');
    const [mid, ...rest] = empties;
    const a = Math.min(n - 1, (cells.length + 1) * 2 ** rest.length);
    rec(a, src, mid, cells, rest);
    rec(n - a, src, dst, cells, rest);
    rec(a, mid, dst, cells, rest);
  };
  try {
    const cells = CELLS.filter((c) => !sim.piles[c].length);
    const empties = TABLEAU.filter((t) => t !== to && t !== from && !sim.piles[t].length);
    rec(count, from, to, cells, empties);
  } catch {
    return null;
  }
  return { steps, state: sim };
}

/** Thử nước đi { from, index, to }; chuỗi nhiều lá được thực hiện bằng các bước từng lá. */
export function tryMove(state, { from, index, to }) {
  if (from === to || !canPick(state, from, index)) return null;
  const ids = state.piles[from].slice(index);
  if (!canPlace(state, ids, to)) return null;
  let next;
  if (ids.length === 1) {
    next = cloneState(state);
    next.piles[to].push(next.piles[from].pop());
  } else {
    if (!isTableau(to) || ids.length > maxMovable(state, to)) return null;
    const result = supermoveSteps(state, from, ids.length, to);
    if (!result) return null;
    next = result.state;
  }
  next.moves++;
  return next;
}

export const isWon = (state) => FOUNDATIONS.reduce((n, f) => n + state.piles[f].length, 0) === 52;

export function foundationFor(state, id) {
  return FOUNDATIONS.find((f) => canPlace(state, [id], f)) || null;
}

function foundationRank(state, suit) {
  const f = FOUNDATIONS.find((p) => state.piles[p].length && cardOf(state.piles[p][0]).suit === suit);
  return f ? state.piles[f].length : 0;
}

/** Lá "an toàn" để tự đưa lên đích: không còn lá nào trên bàn cần nó làm chỗ đặt. */
export function isSafeToFoundation(state, id) {
  const c = cardOf(id);
  if (c.rank <= 2) return true;
  const opposite = isRed(c.suit) ? ['S', 'C'] : ['H', 'D'];
  return opposite.every((s) => foundationRank(state, s) >= c.rank - 1);
}

/** Tự đưa các lá an toàn lên đích (tùy chọn). Không tính là nước đi riêng. */
export function autoplay(state) {
  let next = state;
  for (let changed = true; changed;) {
    changed = false;
    for (const p of [...CELLS, ...TABLEAU]) {
      const id = top(next.piles[p]);
      if (!id || !isSafeToFoundation(next, id)) continue;
      const f = foundationFor(next, id);
      if (!f) continue;
      if (next === state) next = cloneState(state);
      next.piles[f].push(next.piles[p].pop());
      changed = true;
    }
  }
  return next;
}

export function autoTarget(state, pile, index) {
  if (!canPick(state, pile, index)) return null;
  const ids = state.piles[pile].slice(index);
  if (ids.length === 1) {
    const f = foundationFor(state, ids[0]);
    if (f) return f;
  }
  const fits = TABLEAU.filter((t) => t !== pile && canPlace(state, ids, t) && ids.length <= maxMovable(state, t));
  const nonEmpty = fits.find((t) => state.piles[t].length);
  if (nonEmpty) return nonEmpty;
  if (ids.length === 1 && !isCell(pile)) {
    const cell = CELLS.find((c) => !state.piles[c].length);
    if (cell) return cell;
  }
  return fits.find((t) => !(isTableau(pile) && index === 0)) || null;
}

const name = (id) => `${RANK_LABELS[cardOf(id).rank]}${SUIT_SYMBOLS[cardOf(id).suit]}︎`;
const pileName = (p) => (isFoundation(p) ? 'chồng đích' : isCell(p) ? 'ô dự trữ' : `cột ${Number(p[1]) + 1}`);

/** Liệt kê mọi nước đi hợp lệ (dùng cho gợi ý và kiểm thử). */
export function legalMoves(state) {
  const moves = [];
  for (const from of [...CELLS, ...TABLEAU]) {
    const cards = state.piles[from];
    for (let i = 0; i < cards.length; i++) {
      if (!canPick(state, from, i)) continue;
      const ids = cards.slice(i);
      for (const to of [...FOUNDATIONS, ...CELLS, ...TABLEAU]) {
        if (to === from || !canPlace(state, ids, to)) continue;
        if (ids.length > 1 && ids.length > maxMovable(state, to)) continue;
        moves.push({ from, index: i, to });
      }
    }
  }
  return moves;
}

/** Gợi ý MỘT nước đi hợp lệ theo thứ tự ưu tiên đơn giản (không phải bộ giải, không bảo đảm tối ưu). */
export function hint(state) {
  let best = null;
  for (const m of legalMoves(state)) {
    const cards = state.piles[m.from];
    const ids = cards.slice(m.index);
    const below = m.index > 0 ? cards[m.index - 1] : null;
    const exposesFoundation = below && foundationFor(state, below);
    // Chuyển chuỗi đang nằm đúng chỗ sang chỗ tương đương: vô ích.
    const alreadyBuilt = below && isTableau(m.from) && isAlternatingRun([below, ids[0]]);
    if (isCell(m.from) && isCell(m.to)) continue; // đổi ô dự trữ: vô ích
    let pr = 0;
    if (isFoundation(m.to)) pr = 10;
    else if (isTableau(m.to) && state.piles[m.to].length) {
      if (alreadyBuilt) continue;
      pr = isCell(m.from) ? 7 : m.index === 0 ? 8 : 6;
    } else if (isTableau(m.to)) {
      if (m.index === 0 || alreadyBuilt) continue; // cả cột sang cột trống / tách chuỗi đã xếp
      pr = isCell(m.from) ? 3 : 4;
    } else if (isCell(m.to)) {
      if (alreadyBuilt) continue;
      pr = 2;
    }
    if (exposesFoundation) pr += 1.5;
    if (!best || pr > best.pr) best = { pr, m, ids };
  }
  if (!best) return null;
  const { m, ids } = best;
  return { move: m, text: `Chuyển ${name(ids[0])}${ids.length > 1 ? ` (${ids.length} lá)` : ''} từ ${pileName(m.from)} sang ${pileName(m.to)}` };
}
