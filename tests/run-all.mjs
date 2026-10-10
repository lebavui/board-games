// Chạy toàn bộ kiểm thử logic (không cần trình duyệt): node tests/run-all.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = ['sudoku', 'kakuro', 'chess', 'checkers', 'gomoku', 'minesweeper', 'chess-ai', 'checkers-ai', 'gomoku-ai', 'battleship', 'cards-deck', 'klondike', 'freecell', 'spider', 'blackjack'].map((n) => path.join(dir, `${n}.test.mjs`));
let failed = 0;
for (const file of files) {
  console.log(`\n▶ ${path.basename(file)}`);
  const res = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (res.status !== 0) failed++;
}
console.log(failed ? `\n✗ ${failed} tệp kiểm thử thất bại` : '\n✓ Tất cả kiểm thử đều qua');
process.exit(failed ? 1 : 0);
