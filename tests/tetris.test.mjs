// Kiểm thử Xếp gạch. Chạy: node tests/tetris.test.mjs
import assert from 'node:assert/strict';
import {
  COLS, ROWS, HIDDEN_ROWS, TYPES, NEXT_COUNT, LOCK_DELAY, MAX_LOCK_RESETS,
  createGame, start, pause, tick, move, rotate, hardDrop, hold, ghostY, pieceCells, shapeCells,
  gravityInterval, isValidState,
} from '../js/games/tetris/logic.js';

const playing = (opts) => { const g = createGame(opts); start(g); return g; };
const set = (g, x, y, v = 'Z') => { g.board[y * COLS + x] = v; };
const rowOf = (g, y) => g.board.slice(y * COLS, (y + 1) * COLS);
const filled = (g) => g.board.filter((v) => v).length;

// Mỗi khối có đúng 4 ô, bốn trạng thái xoay quay vòng về trạng thái ban đầu.
for (const t of TYPES) {
  for (let r = 0; r < 4; r++) assert.equal(new Set(shapeCells(t, r).map(String)).size, 4, `${t} trạng thái ${r} có 4 ô`);
  assert.deepEqual(shapeCells(t, 4), shapeCells(t, 0));
}

// Túi 7: mỗi nhóm 7 khối liên tiếp có đủ bảy loại; cùng seed → cùng dãy, khác seed → (gần như chắc chắn) khác.
{
  const a = playing({ seed: 7 }), b = playing({ seed: 7 }), c = playing({ seed: 8 });
  const types = (g) => {
    const out = [];
    for (let k = 0; k < 70; k++) {
      out.push(g.piece.type);
      g.board.fill(0); // giữ giếng trống để chơi mãi không thua
      hardDrop(g);
    }
    return out;
  };
  const sa = types(a), sb = types(b), sc = types(c);
  assert.deepEqual(sa, sb, 'cùng seed cho cùng dãy khối');
  assert.notDeepEqual(sa, sc, 'khác seed cho dãy khối khác');
  for (let k = 0; k < 70; k += 7) assert.deepEqual([...sa.slice(k, k + 7)].sort(), [...TYPES].sort(), `túi thứ ${k / 7 + 1} đủ 7 loại`);
  assert.ok(a.queue.length >= NEXT_COUNT);
}

// Khối xuất hiện ở giữa phía trên và rơi ngay một hàng vào vùng nhìn thấy.
{
  for (let seed = 1; seed < 30; seed++) {
    const g = createGame({ seed });
    const cells = pieceCells(g.piece);
    assert.ok(cells.some(([, y]) => y >= HIDDEN_ROWS), 'khối mới lộ ít nhất một hàng');
    assert.ok(cells.every(([x]) => x >= 3 && x <= 6), 'khối mới nằm giữa giếng');
  }
}

// Chưa bắt đầu/tạm dừng thì không thao tác và không rơi.
{
  const g = createGame({ seed: 3 });
  const before = JSON.stringify(g.piece);
  assert.equal(move(g, 1), false);
  assert.equal(tick(g, 5000), false);
  assert.equal(JSON.stringify(g.piece), before);
  start(g);
  pause(g);
  assert.equal(hardDrop(g), false);
  assert.equal(g.status, 'paused');
}

// Di chuyển dừng ở tường.
{
  const g = playing({ seed: 5 });
  let n = 0;
  while (move(g, -1)) n++;
  assert.ok(n > 0 && n <= 4);
  assert.equal(Math.min(...pieceCells(g.piece).map(([x]) => x)), 0);
  while (move(g, 1));
  assert.equal(Math.max(...pieceCells(g.piece).map(([x]) => x)), COLS - 1);
}

// Trọng lực: cấp 1 rơi 1 hàng/giây; rơi nhanh nhanh gấp 20 và +1 điểm mỗi hàng.
{
  assert.equal(gravityInterval(1), 1000);
  assert.ok(gravityInterval(10) < gravityInterval(5) && gravityInterval(20) < 5);
  const g = playing({ seed: 9 });
  const y0 = g.piece.y;
  tick(g, 999);
  assert.equal(g.piece.y, y0);
  tick(g, 1);
  assert.equal(g.piece.y, y0 + 1);
  tick(g, 250, { softDrop: true });
  assert.equal(g.piece.y, y0 + 6);
  assert.equal(g.score, 5);
}

// Thả thẳng: +2 điểm mỗi hàng, khóa ngay và sinh khối mới; bóng khối trùng vị trí sẽ khóa.
{
  const g = playing({ seed: 11 });
  const gy = ghostY(g), y0 = g.piece.y, type = g.piece.type;
  const expect = pieceCells({ ...g.piece, y: gy });
  hardDrop(g);
  assert.equal(g.score, 2 * (gy - y0));
  assert.equal(g.pieces, 1);
  for (const [x, y] of expect) assert.equal(g.board[y * COLS + x], type);
  assert.ok(g.piece, 'có khối mới');
}

// Khóa trễ: chạm đáy 500 ms mới khóa; di chuyển gia hạn, tối đa 15 lần.
{
  const g = playing({ seed: 13 });
  g.piece.y = ghostY(g);
  tick(g, LOCK_DELAY - 1);
  assert.equal(g.pieces, 0);
  tick(g, 1);
  assert.equal(g.pieces, 1, 'khóa sau đúng LOCK_DELAY');

  const h = playing({ seed: 13 });
  h.piece = { type: 'T', rot: 0, x: 3, y: 0 };
  h.piece.y = ghostY(h);
  h.lowestY = h.piece.y;
  let resets = 0;
  for (let k = 0; k < 40; k++) {
    tick(h, LOCK_DELAY - 50);
    if (h.pieces) break;
    move(h, k % 2 ? 1 : -1);
    resets++;
  }
  assert.equal(h.pieces, 1, 'cuối cùng vẫn khóa');
  assert.ok(resets <= MAX_LOCK_RESETS + 1, `không gia hạn quá ${MAX_LOCK_RESETS} lần (đã ${resets})`);
}

// Xóa hàng và tính điểm: Đơn/Đôi/Ba/Tetris nhân cấp; các hàng trên dồn xuống.
for (const [lines, base] of [[1, 100], [2, 300], [3, 500], [4, 800]]) {
  const g = playing({ seed: 17, startLevel: 2 });
  for (let y = ROWS - lines; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (x !== 0) set(g, x, y);
  set(g, 5, ROWS - lines - 1, 'O'); // một ô phía trên để kiểm tra dồn hàng
  // Khối I dọc rơi xuống cột 0: lấp `lines` hàng dưới cùng, các ô thừa nằm lại phía trên.
  g.piece = { type: 'I', rot: 1, x: -2, y: 0 };
  g.piece.y = ghostY(g);
  g.score = 0;
  hardDrop(g);
  assert.equal(g.lines, lines);
  assert.equal(g.score, base * 2, `${lines} hàng = ${base} × cấp 2`);
  assert.equal(rowOf(g, ROWS - 1)[5], 'O', 'hàng phía trên dồn xuống');
  assert.equal(filled(g), 4 - lines + 1, 'chỉ còn phần thừa của khối I và ô phía trên');
  assert.equal(g.lastClear.lines, lines);
}

// Lên cấp sau mỗi 10 hàng tính từ cấp bắt đầu.
{
  const g = playing({ seed: 19, startLevel: 3 });
  for (let k = 0; k < 3; k++) {
    g.board.fill(0);
    for (let y = ROWS - 4; y < ROWS; y++) for (let x = 1; x < COLS; x++) set(g, x, y);
    g.piece = { type: 'I', rot: 1, x: -2, y: 0 };
    hardDrop(g);
  }
  assert.equal(g.lines, 12);
  assert.equal(g.level, 4);
}

// Back-to-back: Tetris thứ hai liên tiếp được ×1,5; combo cộng 50 × combo × cấp.
{
  const g = playing({ seed: 23 });
  const tetris = () => {
    g.board.fill(0);
    for (let y = ROWS - 4; y < ROWS; y++) for (let x = 1; x < COLS; x++) set(g, x, y);
    g.piece = { type: 'I', rot: 1, x: -2, y: 0 };
    const before = g.score;
    hardDrop(g);
    return g.score - before - 2 * (ROWS - 4); // bỏ điểm thả thẳng
  };
  assert.equal(tetris(), 800);
  assert.equal(g.combo, 0);
  assert.equal(tetris(), 1200 + 50, 'B2B ×1,5 cộng combo 1');
  assert.equal(g.lastClear.b2b, true);
  // Đặt một khối không xóa hàng: ngắt combo nhưng giữ B2B.
  g.board.fill(0);
  g.piece = { type: 'O', rot: 0, x: 4, y: 0 };
  hardDrop(g);
  assert.equal(g.combo, -1);
  assert.equal(g.b2b, true);
}

// Xoay SRS: đá tường khi xoay sát tường; khối O không xoay; xoay bị chặn hoàn toàn thì không đổi.
{
  const g = playing({ seed: 29 });
  g.piece = { type: 'I', rot: 1, x: -2, y: 5 }; // I dọc sát tường trái (cột 0)
  assert.ok(rotate(g, 1), 'I dọc sát tường xoay được nhờ đá tường');
  assert.ok(pieceCells(g.piece).every(([x]) => x >= 0));
  assert.equal(g.piece.rot, 2);

  g.piece = { type: 'O', rot: 0, x: 4, y: 5 };
  assert.equal(rotate(g, 1), false);

  g.board.fill('Z');
  g.piece = { type: 'T', rot: 0, x: 3, y: 10 };
  for (const [x, y] of pieceCells(g.piece)) g.board[y * COLS + x] = 0;
  assert.equal(rotate(g, 1), false, 'bị bao kín thì không xoay được');
  assert.equal(g.piece.rot, 0);
}

// Bốn lần xoay cùng chiều trên giếng trống đưa khối về đúng vị trí cũ (bảng đá tường đối xứng).
for (const t of TYPES) {
  const g = playing({ seed: 31 });
  g.piece = { type: t, rot: 0, x: 3, y: 8 };
  const before = JSON.stringify(g.piece);
  for (let k = 0; k < 4; k++) rotate(g, 1);
  assert.equal(JSON.stringify(g.piece), before, `${t} xoay 4 lần về chỗ cũ`);
  for (let k = 0; k < 4; k++) rotate(g, -1);
  assert.equal(JSON.stringify(g.piece), before);
}

// T-spin Đôi: khe hình chữ T, xoay vào rồi khóa → 1200 × cấp.
{
  const g = playing({ seed: 37 });
  const B = ROWS - 1;
  // Hàng dưới cùng: trống cột 4; hàng kế: trống cột 3–5; hàng trên nữa: chỉ có ô "mái" ở cột 3.
  for (let x = 0; x < COLS; x++) {
    if (x !== 4) set(g, x, B);
    if (x < 3 || x > 5) set(g, x, B - 1);
  }
  set(g, 3, B - 2);
  // T hướng xuống (rot 2) phải vào bằng phép xoay; đặt T rot 1 ngay trên khe rồi xoay.
  g.piece = { type: 'T', rot: 1, x: 3, y: B - 2 };
  assert.ok(rotate(g, 1), 'xoay vào khe');
  assert.equal(g.piece.rot, 2);
  g.score = 0;
  hardDrop(g);
  assert.equal(g.lines, 2);
  assert.equal(g.lastClear.tspin, true);
  assert.equal(g.score, 1200);
}

// Giữ khối: lần đầu lấy khối tiếp theo, lần sau đổi chỗ; chỉ một lần cho mỗi khối.
{
  const g = playing({ seed: 41 });
  const first = g.piece.type, next = g.queue[0];
  assert.ok(hold(g));
  assert.equal(g.hold, first);
  assert.equal(g.piece.type, next);
  assert.equal(hold(g), false, 'không giữ hai lần liên tiếp');
  hardDrop(g);
  const cur = g.piece.type;
  assert.ok(hold(g));
  assert.equal(g.piece.type, first);
  assert.equal(g.hold, cur);
}

// Thua khi khối mới không có chỗ xuất hiện.
{
  const g = playing({ seed: 43 });
  // Cột 3–6 đầy tới đỉnh (không hàng nào đầy); khối I dọc ở cột 0 khóa xong thì khối mới không còn chỗ.
  for (let y = 0; y < ROWS; y++) for (let x = 3; x <= 6; x++) set(g, x, y);
  g.piece = { type: 'I', rot: 1, x: -2, y: 0 };
  hardDrop(g);
  assert.equal(g.status, 'over');
  assert.equal(hardDrop(g), false, 'hết ván thì không thao tác');
  assert.equal(tick(g, 1000), false);
}

// Lưu → JSON → tải: trạng thái hợp lệ và dãy khối tiếp tục giống hệt; bản hỏng bị từ chối.
{
  const a = playing({ seed: 47 });
  for (let k = 0; k < 5; k++) { a.board.fill(0); hardDrop(a); }
  const b = JSON.parse(JSON.stringify(a));
  assert.ok(isValidState(b));
  const seq = (g) => { const out = []; for (let k = 0; k < 20; k++) { out.push(g.piece.type); g.board.fill(0); hardDrop(g); } return out; };
  assert.deepEqual(seq(a), seq(b));
  assert.equal(isValidState(null), false);
  assert.equal(isValidState({ ...b, board: b.board.slice(1) }), false);
  assert.equal(isValidState({ ...b, queue: ['Q', ...b.queue] }), false);
  assert.equal(isValidState({ ...b, status: 'lạ' }), false);
  assert.equal(isValidState({ ...b, score: 'nhiều' }), false);
  const overlap = JSON.parse(JSON.stringify(b));
  for (const [x, y] of pieceCells(overlap.piece)) if (y >= 0) overlap.board[y * COLS + x] = 'Z';
  assert.equal(isValidState(overlap), false, 'khối chồng lên ô đã khóa');
}

// Mô phỏng ngẫu nhiên: không bao giờ có khối chồng lên ô đã khóa; giếng luôn đủ kích thước; luôn kết thúc.
{
  let seed = 1;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let game = 0; game < 30; game++) {
    const g = playing({ seed: game + 100, startLevel: 1 + (game % 15) });
    let steps = 0;
    while (g.status === 'playing' && steps < 20000) {
      const r = rng();
      if (r < 0.3) move(g, rng() < 0.5 ? -1 : 1);
      else if (r < 0.5) rotate(g, rng() < 0.5 ? -1 : 1);
      else if (r < 0.55) hold(g);
      else if (r < 0.6) hardDrop(g);
      else tick(g, 16 + rng() * 40, { softDrop: rng() < 0.3 });
      assert.equal(g.board.length, COLS * ROWS);
      if (g.piece && g.status === 'playing') {
        for (const [x, y] of pieceCells(g.piece)) {
          assert.ok(x >= 0 && x < COLS && y < ROWS);
          if (y >= 0) assert.equal(g.board[y * COLS + x], 0, 'khối không chồng lên ô đã khóa');
        }
      }
      steps++;
    }
    assert.equal(g.status, 'over', 'ván ngẫu nhiên kết thúc');
    assert.ok(isValidState(JSON.parse(JSON.stringify(g))));
  }
}

console.log('✓ Xếp gạch: mọi kiểm thử đều qua');
