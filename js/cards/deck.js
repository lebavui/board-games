// Bộ bài dùng chung cho các game bài — thuần dữ liệu, không DOM, không p5.
//
// - Lá bài là dữ liệu bất biến { id, suit, rank, deck }. ID dạng "S12.0" = chất + hạng + "." + số thứ tự bộ,
//   nên nhiều bộ bài trong cùng một ván vẫn không trùng ID và có thể đọc lại lá bài chỉ từ ID.
// - Trạng thái úp/ngửa (bản đồ id → true) và vị trí hiển thị KHÔNG nằm trong lá bài:
//   chồng bài là mảng ID (phần tử cuối = lá trên cùng), còn tọa độ do mã vẽ tự tính.
// - Xáo bài bằng Fisher–Yates với bộ sinh số ngẫu nhiên có seed để tái hiện ván chơi và kiểm thử.

export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOLS = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAMES = { S: 'Bích', H: 'Cơ', D: 'Rô', C: 'Chuồn' };
export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const isRed = (suit) => suit === 'H' || suit === 'D';

/** Tạo bộ bài: `decks` bộ, mỗi bộ gồm 13 hạng × các chất trong `suits`. Không có Joker. */
export function createDeck({ decks = 1, suits = SUITS } = {}) {
  const cards = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) cards.push(makeCard(suit, rank, d));
    }
  }
  return cards;
}

function makeCard(suit, rank, deck) {
  return Object.freeze({ id: `${suit}${rank}.${deck}`, suit, rank, deck });
}

const cache = new Map();
/** Đọc lá bài từ ID (có bộ nhớ đệm). Trả về null nếu ID không hợp lệ. */
export function cardOf(id) {
  let card = cache.get(id);
  if (card) return card;
  const m = /^([SHDC])(\d{1,2})\.(\d+)$/.exec(id);
  if (!m) return null;
  const rank = Number(m[2]);
  if (rank < 1 || rank > 13) return null;
  card = makeCard(m[1], rank, Number(m[3]));
  cache.set(id, card);
  return card;
}

export function cardLabel(id) {
  const c = cardOf(id);
  return c ? `${RANK_LABELS[c.rank]}${SUIT_SYMBOLS[c.suit]}︎` : '?';
}

/* ---------- Ngẫu nhiên có seed ---------- */

/** Mulberry32: nhanh, đủ tốt cho xáo bài, cùng seed → cùng dãy số. Trả về số trong [0, 1). */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed ngẫu nhiên 1 … 999 999 999 (dễ đọc khi hiển thị “Ván #…”). */
export function randomSeed() {
  let x;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) x = crypto.getRandomValues(new Uint32Array(1))[0];
  else x = Math.floor(Math.random() * 2 ** 32);
  return (x % 999999999) + 1;
}

/** Trộn hai số thành seed mới (ví dụ seed phiên + số lần xáo lại shoe). */
export function mixSeed(seed, salt) {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Xáo Fisher–Yates; trả về mảng mới, không sửa mảng gốc. */
export function shuffle(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Chia và di chuyển bài ---------- */

/** Lấy `count` lá trên cùng của chồng `source` (mảng bị sửa); kết quả giữ thứ tự dưới → trên. */
export function deal(source, count = 1) {
  if (count <= 0) return [];
  if (count > source.length) throw new Error(`Không đủ bài để chia: cần ${count}, còn ${source.length}`);
  return source.splice(source.length - count, count);
}

/** Chuyển `count` lá trên cùng từ piles[from] sang piles[to], giữ nguyên thứ tự. Trả về các ID đã chuyển. */
export function moveCards(piles, from, to, count = 1) {
  const moved = deal(piles[from], count);
  piles[to].push(...moved);
  return moved;
}

export const top = (pile) => pile[pile.length - 1];

/** Kiểm tra mọi lá trong `piles` khớp đúng tập `expectedIds` — không mất, không thừa, không trùng. */
export function verifyPiles(piles, expectedIds) {
  const seen = new Set();
  for (const pile of Object.values(piles)) {
    if (!Array.isArray(pile)) return false;
    for (const id of pile) {
      if (seen.has(id)) return false;
      seen.add(id);
    }
  }
  if (seen.size !== expectedIds.length) return false;
  return expectedIds.every((id) => seen.has(id));
}

/** Bản sao sâu của trạng thái dạng JSON (chồng bài + bản đồ úp/ngửa + số liệu). */
export const cloneState = (state) => JSON.parse(JSON.stringify(state));
