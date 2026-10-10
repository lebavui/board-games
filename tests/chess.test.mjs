// Kiểm thử lớp ChessGame (bao quanh chess.js). Chạy: node tests/chess.test.mjs
import assert from 'node:assert/strict';
import { ChessGame } from '../js/games/chess/logic.js';

const play = (g, list) => list.forEach(([from, to, promotion]) => assert.ok(g.move({ from, to, promotion }), `${from}-${to}`));

// Chiếu hết (Scholar's mate)
let g = new ChessGame();
play(g, [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]);
assert.deepEqual([g.status().type, g.status().winner], ['checkmate', 'w']);
assert.equal(g.move({ from: 'a7', to: 'a6' }), null, 'khóa nước đi sau khi hết ván');
g.undo();
assert.equal(g.status().over, false, 'hoàn tác mở lại ván');

// Không cho đi nước khiến vua bị chiếu (quân bị ghim)
g = new ChessGame();
play(g, [['e2', 'e4'], ['e7', 'e5'], ['d2', 'd4'], ['f8', 'b4']]);
assert.equal(g.move({ from: 'c2', to: 'c3' }) !== null, true);
g = new ChessGame();
play(g, [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5'], ['d2', 'd4'], ['d5', 'e5']]);
assert.equal(g.move({ from: 'g1', to: 'f3' }), null, 'đang bị chiếu thì phải đỡ chiếu');

// Nhập thành
g = new ChessGame();
play(g, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6']]);
const castle = g.move({ from: 'e1', to: 'g1' });
assert.ok(castle && castle.isKingsideCastle());

// Bắt tốt qua đường
g = new ChessGame();
play(g, [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5']]);
const ep = g.move({ from: 'e5', to: 'd6' });
assert.ok(ep && ep.isEnPassant());
assert.deepEqual(g.captured().w, ['p']);

// Phong cấp (chọn Mã)
g = new ChessGame();
play(g, [['h2', 'h4'], ['g7', 'g5'], ['h4', 'g5'], ['f8', 'h6'], ['g5', 'g6'], ['g8', 'f6'], ['g6', 'g7'], ['a7', 'a6']]);
const promo = g.move({ from: 'g7', to: 'h8', promotion: 'n' });
assert.ok(promo && promo.promotion === 'n');
assert.equal(g.chess.get('h8').type, 'n');

// Hết nước (stalemate) — ván nhanh nổi tiếng của Sam Loyd (10 nước)
g = new ChessGame();
play(g, [['e2', 'e3'], ['a7', 'a5'], ['d1', 'h5'], ['a8', 'a6'], ['h5', 'a5'], ['h7', 'h5'], ['h2', 'h4'], ['a6', 'h6'],
  ['a5', 'c7'], ['f7', 'f6'], ['c7', 'd7'], ['e8', 'f7'], ['d7', 'b7'], ['d8', 'd3'], ['b7', 'b8'], ['d3', 'h7'],
  ['b8', 'c8'], ['f7', 'g6'], ['c8', 'e6']]);
assert.equal(g.status().type, 'stalemate');

// Lặp lại ba lần
g = new ChessGame();
const shuffle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
play(g, [...shuffle, ...shuffle]);
assert.equal(g.status().type, 'threefold');

// Thiếu quân: Vua + Tượng đấu Vua
g = new ChessGame();
g.chess.load('8/8/8/4k3/8/8/2B5/4K3 w - - 0 1');
assert.equal(g.status().type, 'insufficient');
// Vua + Tượng đấu Vua + Tượng khác màu ô: vẫn có thể chiếu hết => chưa hòa
g.chess.load('8/8/8/4k3/8/4b3/2B5/4K3 w - - 0 1');
assert.equal(g.status().over, false);
// Tượng cùng màu ô: hòa
g.chess.load('8/8/8/4k3/8/3b4/2B5/4K3 w - - 0 1');
assert.equal(g.status().type, 'insufficient');
// Vua + Mã đấu Vua + Mã: chưa hòa
g.chess.load('8/8/3n4/4k3/8/8/2N5/4K3 w - - 0 1');
assert.equal(g.status().over, false);

// Quy tắc 50 nước
g = new ChessGame();
g.chess.load('8/8/8/4k3/8/8/R7/4K3 w - - 99 80');
assert.equal(g.status().over, false);
g.move({ from: 'a2', to: 'a3' });
assert.equal(g.status().type, 'fifty');

// Khôi phục ván từ danh sách nước đi
g = new ChessGame();
play(g, [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]);
const restored = new ChessGame(g.serialize());
assert.equal(restored.chess.fen(), g.chess.fen());

console.log('✓ Tất cả kiểm thử cờ vua đều qua');
