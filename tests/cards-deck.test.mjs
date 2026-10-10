// Kiểm thử module bộ bài dùng chung. Chạy: node tests/cards-deck.test.mjs
import assert from 'node:assert/strict';
import { createDeck, cardOf, createRng, shuffle, deal, moveCards, verifyPiles, mixSeed, randomSeed, SUITS } from '../js/cards/deck.js';

// Một bộ: 52 lá, không Joker, 13 hạng × 4 chất, ID duy nhất.
const one = createDeck();
assert.equal(one.length, 52);
assert.equal(new Set(one.map((c) => c.id)).size, 52);
for (const s of SUITS) assert.equal(one.filter((c) => c.suit === s).length, 13);
for (let r = 1; r <= 13; r++) assert.equal(one.filter((c) => c.rank === r).length, 4);

// Nhiều bộ trong một ván vẫn không trùng ID; đọc lại được lá bài từ ID.
const six = createDeck({ decks: 6 });
assert.equal(six.length, 312);
assert.equal(new Set(six.map((c) => c.id)).size, 312);
const spider1 = createDeck({ decks: 8, suits: ['S'] });
assert.equal(spider1.length, 104);
assert.equal(new Set(spider1.map((c) => c.id)).size, 104);
for (const c of six) assert.deepEqual({ ...cardOf(c.id) }, { ...c });
assert.equal(cardOf('X1.0'), null);
assert.equal(cardOf('S14.0'), null);
assert.ok(Object.isFrozen(one[0]), 'dữ liệu lá bài bất biến');
assert.deepEqual(Object.keys(one[0]).sort(), ['deck', 'id', 'rank', 'suit'], 'lá bài không chứa trạng thái úp/ngửa hay vị trí');

// Xáo bài: không mất / không thêm lá, không sửa mảng gốc, cùng seed → cùng thứ tự.
const ids = six.map((c) => c.id);
for (let seed = 1; seed <= 50; seed++) {
  const a = shuffle(ids, createRng(seed));
  assert.equal(a.length, ids.length);
  assert.deepEqual([...a].sort(), [...ids].sort());
  assert.deepEqual(shuffle(ids, createRng(seed)), a, 'seed tái hiện được ván');
}
assert.equal(ids[0], 'S1.0', 'mảng gốc giữ nguyên');
assert.notDeepEqual(shuffle(ids, createRng(1)), shuffle(ids, createRng(2)));
assert.notEqual(mixSeed(5, 1), mixSeed(5, 2));
for (let i = 0; i < 100; i++) { const s = randomSeed(); assert.ok(s >= 1 && s <= 999999999 && Number.isInteger(s)); }

// Fisher–Yates không thiên lệch rõ rệt: mỗi lá xuất hiện ở vị trí đầu với tần suất gần đều.
const counts = new Array(5).fill(0);
const rng = createRng(12345);
for (let i = 0; i < 50000; i++) counts[shuffle([0, 1, 2, 3, 4], rng)[0]]++;
for (const c of counts) assert.ok(Math.abs(c - 10000) < 600, `phân bố đều: ${counts}`);

// Chia và di chuyển bài.
const stock = ['a', 'b', 'c', 'd'];
assert.deepEqual(deal(stock, 2), ['c', 'd']);
assert.deepEqual(stock, ['a', 'b']);
assert.throws(() => deal(stock, 3));
const piles = { x: ['1', '2', '3'], y: ['9'] };
assert.deepEqual(moveCards(piles, 'x', 'y', 2), ['2', '3']);
assert.deepEqual(piles, { x: ['1'], y: ['9', '2', '3'] });
assert.ok(verifyPiles(piles, ['1', '2', '3', '9']));
assert.ok(!verifyPiles({ x: ['1', '1'], y: ['2', '3'] }, ['1', '2', '3', '9']), 'phát hiện trùng lá');
assert.ok(!verifyPiles({ x: ['1'], y: ['2', '3'] }, ['1', '2', '3', '9']), 'phát hiện mất lá');
assert.ok(!verifyPiles({ x: ['1', '7'], y: ['2', '3', '9'] }, ['1', '2', '3', '9']), 'phát hiện lá lạ');

console.log('✓ Tất cả kiểm thử bộ bài đều qua');
