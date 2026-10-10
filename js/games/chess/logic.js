// Lớp bao quanh chess.js: toàn bộ luật cờ vua (nước hợp lệ, chiếu, nhập thành, bắt tốt qua đường,
// phong cấp, các kiểu hòa) do chess.js đảm nhiệm; lớp này chỉ chuẩn hóa trạng thái cho giao diện.
import { Chess } from '../../vendor/chess.js';

export const PIECE_NAMES = { p: 'Tốt', n: 'Mã', b: 'Tượng', r: 'Xe', q: 'Hậu', k: 'Vua' };
export const COLOR_NAMES = { w: 'Trắng', b: 'Đen' };
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export class ChessGame {
  /** @param {Array<{from,to,promotion?}>} moves các nước đã đi (để khôi phục ván) */
  constructor(moves = [], manualResult = null) {
    this.chess = new Chess();
    this.manualResult = manualResult; // { type: 'resign' | 'agreement', winner }
    for (const m of moves) {
      if (!this.move(m)) break; // Bỏ phần dữ liệu lưu không hợp lệ.
    }
    this.manualResult = manualResult;
  }

  get turn() { return this.chess.turn(); }

  board() { return this.chess.board(); }

  history() { return this.chess.history({ verbose: true }); }

  /** Danh sách nước đi tối giản để lưu trữ. */
  serialize() {
    return this.history().map((m) => ({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }));
  }

  legalMovesFrom(square) {
    if (this.status().over) return [];
    return this.chess.moves({ square, verbose: true });
  }

  /** Thực hiện nước đi; trả về đối tượng Move của chess.js hoặc null nếu không hợp lệ. */
  move({ from, to, promotion }) {
    if (this.status().over) return null;
    try {
      return this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
  }

  undo() {
    this.manualResult = null;
    return this.chess.undo();
  }

  resign(color) {
    this.manualResult = { type: 'resign', winner: color === 'w' ? 'b' : 'w' };
  }

  agreeDraw() {
    this.manualResult = { type: 'agreement', winner: null };
  }

  inCheck() { return this.chess.inCheck(); }

  kingSquare(color) {
    for (const row of this.chess.board()) for (const sq of row) if (sq && sq.type === 'k' && sq.color === color) return sq.square;
    return null;
  }

  /**
   * Trạng thái ván. Thứ tự ưu tiên: chiếu hết > hết nước (stalemate) > thiếu quân > lặp 3 lần > 50 nước.
   * Hòa do lặp ba lần và quy tắc 50 nước được tuyên bố tự động.
   */
  status() {
    const c = this.chess;
    if (this.manualResult) return { over: true, ...this.manualResult };
    if (c.isCheckmate()) return { over: true, type: 'checkmate', winner: c.turn() === 'w' ? 'b' : 'w' };
    if (c.isStalemate()) return { over: true, type: 'stalemate', winner: null };
    if (c.isInsufficientMaterial()) return { over: true, type: 'insufficient', winner: null };
    if (c.isThreefoldRepetition()) return { over: true, type: 'threefold', winner: null };
    if (c.isDrawByFiftyMoves()) return { over: true, type: 'fifty', winner: null };
    return { over: false, type: null, winner: null, check: c.inCheck() };
  }

  /** Quân đã bị bắt: captured.w = quân Đen bị Trắng bắt; captured.b = quân Trắng bị Đen bắt. */
  captured() {
    const out = { w: [], b: [] };
    for (const m of this.history()) if (m.captured) out[m.color].push(m.captured);
    const order = 'qrbnp';
    for (const k of ['w', 'b']) out[k].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return out;
  }

  /** Chênh lệch vật chất (dương = Trắng hơn). */
  materialBalance() {
    let score = 0;
    for (const row of this.chess.board()) for (const sq of row) if (sq) score += (sq.color === 'w' ? 1 : -1) * VALUES[sq.type];
    return score;
  }

  /** Lịch sử dạng cặp [số nước, SAN trắng, SAN đen]. */
  sanPairs() {
    const sans = this.chess.history();
    const pairs = [];
    for (let i = 0; i < sans.length; i += 2) pairs.push([i / 2 + 1, sans[i], sans[i + 1] || '']);
    return pairs;
  }

  lastMove() {
    const h = this.history();
    return h.length ? h[h.length - 1] : null;
  }
}

export function describeResult(status) {
  switch (status.type) {
    case 'checkmate': return { title: `${COLOR_NAMES[status.winner]} thắng!`, message: 'Chiếu hết.', tone: 'win' };
    case 'resign': return { title: `${COLOR_NAMES[status.winner]} thắng!`, message: `${COLOR_NAMES[status.winner === 'w' ? 'b' : 'w']} đầu hàng.`, tone: 'win' };
    case 'stalemate': return { title: 'Hòa', message: 'Hết nước đi hợp lệ nhưng không bị chiếu (stalemate).', tone: 'draw' };
    case 'insufficient': return { title: 'Hòa', message: 'Không đủ quân để chiếu hết.', tone: 'draw' };
    case 'threefold': return { title: 'Hòa', message: 'Cùng một thế cờ lặp lại ba lần.', tone: 'draw' };
    case 'fifty': return { title: 'Hòa', message: 'Quy tắc 50 nước: 50 nước liên tiếp mỗi bên không có bắt quân hay đi tốt.', tone: 'draw' };
    case 'agreement': return { title: 'Hòa', message: 'Hai bên đồng ý hòa.', tone: 'draw' };
    default: return null;
  }
}
