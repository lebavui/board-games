// Kiểm thử Dò mìn. Chạy: node tests/minesweeper.test.mjs
import assert from 'node:assert/strict';
import { createGame, reveal, toggleFlag, chord, neighbors, minesLeft, LEVELS } from '../js/games/minesweeper/logic.js';

let seed = 1;
const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// Kích thước và số mìn theo cấp độ.
assert.deepEqual([LEVELS.easy.cols, LEVELS.easy.rows, LEVELS.easy.mines], [9, 9, 10]);
assert.deepEqual([LEVELS.medium.cols, LEVELS.medium.rows, LEVELS.medium.mines], [16, 16, 40]);
assert.deepEqual([LEVELS.hard.cols, LEVELS.hard.rows, LEVELS.hard.mines], [30, 16, 99]);

// Lần mở đầu tiên luôn an toàn (thử 300 lần ở mọi cấp, mọi vị trí).
for (const level of Object.keys(LEVELS)) {
  for (let k = 0; k < 100; k++) {
    const g = createGame(level);
    const first = Math.floor(rng() * g.cols * g.rows);
    assert.equal(g.mineAt, null, 'chưa có mìn trước lần mở đầu tiên');
    reveal(g, first, rng);
    assert.notEqual(g.status, 'lost');
    assert.equal(g.mineAt.reduce((a, b) => a + b), g.mines);
    assert.equal(g.mineAt[first], 0);
    for (const j of neighbors(g, first)) assert.equal(g.mineAt[j], 0, 'ô kề lần mở đầu cũng an toàn');
    assert.equal(g.counts[first], 0);
    assert.ok(g.revealedCount > 1, 'tự mở lan vùng trống');
  }
}

// Mở lan dừng ở viền số; cờ không bị mở tự động.
let g = createGame('easy');
reveal(g, 40, rng);
for (let i = 0; i < 81; i++) {
  if (!g.revealed[i] || g.counts[i] !== 0) continue;
  for (const j of neighbors(g, i)) assert.equal(g.revealed[j], 1, 'mọi ô kề ô trống đều được mở');
}

// Cắm cờ, đếm mìn còn lại, mở nhanh.
const hidden = g.revealed.findIndex((x) => !x);
toggleFlag(g, hidden);
assert.equal(minesLeft(g), 9);
assert.equal(reveal(g, hidden, rng), false, 'không mở ô đã cắm cờ');
toggleFlag(g, hidden);

// Thắng: mở hết ô an toàn.
g = createGame('easy');
reveal(g, 0, rng);
for (let i = 0; i < 81; i++) if (!g.mineAt[i]) reveal(g, i, rng);
assert.equal(g.status, 'won');
assert.equal(minesLeft(g), 0, 'tự cắm cờ mìn khi thắng');

// Thua: mở trúng mìn, khóa bàn.
g = createGame('easy');
reveal(g, 0, rng);
const mine = g.mineAt.indexOf(1);
reveal(g, mine, rng);
assert.equal(g.status, 'lost');
assert.equal(g.exploded, mine);
assert.equal(toggleFlag(g, g.revealed.indexOf(0)), false, 'khóa bàn sau khi thua');

// Mở nhanh (chord) với cờ sai dẫn tới thua.
g = createGame('easy');
reveal(g, 40, rng);
const numbered = g.revealed.findIndex((r, i) => r && g.counts[i] > 0);
const around = neighbors(g, numbered).filter((j) => !g.revealed[j]);
const safeOnes = around.filter((j) => !g.mineAt[j]);
for (let k = 0; k < g.counts[numbered] && k < safeOnes.length; k++) toggleFlag(g, safeOnes[k]);
if (around.filter((j) => g.flagged[j]).length === g.counts[numbered]) {
  chord(g, numbered, rng);
  assert.equal(g.status, 'lost', 'cờ sai + mở nhanh => trúng mìn');
}

console.log('✓ Tất cả kiểm thử dò mìn đều qua');
