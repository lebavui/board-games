// Logic Cờ caro (Gomoku) luật tự do: bàn 15×15 giao điểm, Đen đi trước,
// ai có ≥ 5 quân liên tiếp (ngang, dọc, chéo) trước sẽ thắng. Không áp dụng luật cấm Renju.
export const SIZE = 15;
export const BLACK = 1;
export const WHITE = 2;
export const COLOR_NAMES = { [BLACK]: 'Đen', [WHITE]: 'Trắng' };

export function createGame() {
  return { board: new Array(SIZE * SIZE).fill(0), moves: [], result: null };
}

export const currentPlayer = (game) => (game.moves.length % 2 === 0 ? BLACK : WHITE);

/** Đường thắng đi qua ô i (toàn bộ chuỗi liên tiếp ≥ 5), hoặc null. */
export function winningLine(board, i) {
  const color = board[i];
  if (!color) return null;
  const r = Math.floor(i / SIZE), c = i % SIZE;
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [i];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign, cc = c + dc * sign;
      while (rr >= 0 && cc >= 0 && rr < SIZE && cc < SIZE && board[rr * SIZE + cc] === color) {
        line.push(rr * SIZE + cc);
        rr += dr * sign; cc += dc * sign;
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/** Đặt quân tại giao điểm i. Trả về true nếu hợp lệ. */
export function play(game, i) {
  if (game.result || i < 0 || i >= SIZE * SIZE || game.board[i]) return false;
  const color = currentPlayer(game);
  game.board[i] = color;
  game.moves.push(i);
  const line = winningLine(game.board, i);
  if (line) game.result = { winner: color, line };
  else if (game.moves.length === SIZE * SIZE) game.result = { winner: 0, line: null };
  return true;
}

export function undo(game) {
  const i = game.moves.pop();
  if (i === undefined) return false;
  game.board[i] = 0;
  game.result = null;
  return true;
}

/** Dựng lại ván từ danh sách nước đi (dùng khi khôi phục từ localStorage). */
export function fromMoves(moves) {
  const game = createGame();
  for (const i of moves) if (!play(game, i)) break;
  return game;
}

export const COLS = 'ABCDEFGHJKLMNOP'; // bỏ chữ I theo quy ước bàn cờ
export const coordName = (i) => `${COLS[i % SIZE]}${SIZE - Math.floor(i / SIZE)}`;
