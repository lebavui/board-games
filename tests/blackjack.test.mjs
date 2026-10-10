// Kiểm thử Blackjack. Chạy: node tests/blackjack.test.mjs
import assert from 'node:assert/strict';
import * as B from '../js/games/blackjack/logic.js';

// Shoe 6 bộ: 312 lá, ID không trùng; cùng seed → cùng shoe; xáo lại khác thứ tự.
assert.equal(B.SHOE_IDS.length, 312);
assert.equal(new Set(B.SHOE_IDS).size, 312);
assert.equal(B.RESHUFFLE_AT, 234);
const s0 = B.createSession(7);
assert.deepEqual([...s0.shoe].sort(), [...B.SHOE_IDS].sort());
assert.deepEqual(B.createSession(7).shoe, s0.shoe);
assert.notDeepEqual(B.newShoe(7, 1), s0.shoe);

// Tính điểm: A = 1 hoặc 11, J/Q/K = 10, nhiều lá A.
const hv = (...ids) => B.handValue(ids);
assert.deepEqual(hv('S1.0', 'H13.0'), { total: 21, soft: true, blackjack: true, bust: false });
assert.equal(hv('S1.0', 'H1.0').total, 12);
assert.ok(hv('S1.0', 'H1.0').soft);
assert.equal(hv('S1.0', 'H1.0', 'D1.0').total, 13);
assert.equal(hv('S1.0', 'H1.0', 'D1.0', 'C1.0').total, 14);
assert.equal(hv('S1.0', 'H1.0', 'C9.0').total, 21);
assert.equal(hv('S1.0', 'H1.0', 'C9.0', 'D5.0').total, 16, 'cả hai A tính 1 khi cần');
assert.ok(!hv('S1.0', 'H1.0', 'C9.0', 'D5.0').soft);
assert.equal(hv('S1.0', 'H6.0').total, 17);
assert.ok(hv('S1.0', 'H6.0').soft, 'soft 17');
assert.equal(hv('S1.0', 'H6.0', 'C10.0').total, 17);
assert.ok(!hv('S1.0', 'H6.0', 'C10.0').soft, 'hard 17');
assert.equal(hv('S11.0', 'H12.0').total, 20, 'J, Q tính 10');
assert.ok(hv('S13.0', 'H5.0', 'C9.0').bust);
// Blackjack tự nhiên ≠ 21 từ ba lá trở lên.
assert.ok(!hv('S7.0', 'H7.0', 'C7.0').blackjack);
assert.equal(hv('S7.0', 'H7.0', 'C7.0').total, 21);
assert.ok(!hv('S1.0', 'H5.0', 'C5.0').blackjack);
assert.ok(hv('D10.0', 'C1.0').blackjack);

/** Phiên có shoe dựng sẵn: các lá theo thứ tự chia P, D(ngửa), P, D(úp), rồi các lá rút tiếp. */
function rigged(order, { balance = 1000, bet = 100 } = {}) {
  const s = B.createSession(1, { balance });
  const rest = B.SHOE_IDS.filter((id) => !order.includes(id));
  s.shoe = [...order, ...rest];
  s.bet = bet;
  return s;
}

// Blackjack tự nhiên trả 3:2 (cược 100 → nhận lại 250, lãi 150).
let s = B.deal(rigged(['S1.0', 'H9.0', 'C13.0', 'D7.0']));
assert.equal(s.phase, 'done');
assert.equal(s.result.outcome, 'blackjack');
assert.equal(s.result.payout, 250);
assert.equal(s.balance, 1150);
// Cược 10 → 3:2 = 15, số nguyên chính xác. Mọi mức cược hợp lệ đều trả số nguyên.
s = B.deal(rigged(['S1.0', 'H9.0', 'C13.0', 'D7.0'], { bet: 10 }));
assert.equal(s.balance, 1015);
for (let bet = B.MIN_BET; bet <= 1000; bet += B.BET_UNIT) assert.ok(Number.isInteger((bet * 3) / 2));
assert.ok(!B.isValidBet(B.createSession(1), 15), 'cược phải là bội số của 10');
assert.ok(!B.isValidBet(B.createSession(1), 5));
assert.ok(!B.isValidBet(B.createSession(1, { balance: 40 }), 50), 'không cược quá số điểm');

// Nhà cái peek: lá ngửa A hoặc 10 điểm, có Blackjack → ván kết thúc trước khi người chơi hành động.
s = B.deal(rigged(['S10.0', 'H1.0', 'C9.0', 'D13.0']));
assert.equal(s.phase, 'done');
assert.equal(s.result.outcome, 'dealer-blackjack');
assert.equal(s.balance, 900);
assert.equal(s.player.length, 2, 'người chơi không được hành động');
s = B.deal(rigged(['S10.0', 'H12.0', 'C9.0', 'D1.0']));
assert.equal(s.result.outcome, 'dealer-blackjack', 'lá ngửa 10 điểm cũng peek');
s = B.deal(rigged(['S1.0', 'H1.1', 'C13.0', 'D12.0']));
assert.equal(s.result.outcome, 'push', 'cả hai Blackjack: hòa');
assert.equal(s.balance, 1000);
// Lá ngửa A nhưng không có Blackjack → người chơi tiếp tục.
s = B.deal(rigged(['S10.0', 'H1.0', 'C7.0', 'D9.0']));
assert.equal(s.phase, 'player');
assert.ok(s.holeHidden);

// Hit / Stand; nhà cái dừng ở soft 17.
s = B.deal(rigged(['S10.0', 'H1.0', 'C7.0', 'D6.0', 'C2.0']));
s = B.stand(s);
assert.deepEqual(s.dealer, ['H1.0', 'D6.0'], 'nhà cái dừng ở soft 17');
assert.equal(s.result.outcome, 'push');
s = B.deal(rigged(['S10.0', 'H5.0', 'C8.0', 'D6.0', 'C2.0', 'S3.0', 'S9.0']));
s = B.hit(s);
assert.equal(s.phase, 'player');
assert.equal(B.handValue(s.player).total, 20);
s = B.stand(s);
assert.deepEqual(s.dealer, ['H5.0', 'D6.0', 'S3.0', 'S9.0'], 'nhà cái rút tới khi ≥ 17 (23 → quá)');
assert.equal(s.result.outcome, 'dealer-bust');
assert.equal(s.balance, 1100);
// Người chơi quá 21: thua ngay, nhà cái không rút.
s = B.deal(rigged(['S10.0', 'H5.0', 'C8.0', 'D6.0', 'C9.0']));
s = B.hit(s);
assert.equal(s.result.outcome, 'bust');
assert.equal(s.dealer.length, 2);
assert.equal(s.balance, 900);
// 21 điểm từ ba lá thắng thường 1:1 (không phải 3:2) và tự dừng.
s = B.deal(rigged(['S7.0', 'H10.0', 'C7.1', 'D8.0', 'D7.0']));
s = B.hit(s);
assert.equal(s.phase, 'done');
assert.equal(s.result.outcome, 'win');
assert.equal(s.result.payout, 200);
assert.equal(s.balance, 1100);
assert.throws(() => B.hit(s), 'không rút sau khi ván kết thúc');

// Double Down: chỉ với 2 lá đầu, cần đủ điểm, gấp đôi cược, nhận đúng một lá rồi dừng.
s = B.deal(rigged(['S6.0', 'H10.0', 'C5.0', 'D7.0', 'C10.0', 'S2.0']));
assert.ok(B.canDouble(s));
s = B.doubleDown(s);
assert.equal(s.player.length, 3, 'đúng một lá');
assert.equal(s.bet, 200);
assert.ok(s.doubled);
assert.deepEqual(s.dealer, ['H10.0', 'D7.0'], 'nhà cái 17 dừng');
assert.equal(s.result.outcome, 'win');
assert.equal(s.balance, 1200, '1000 − 100 − 100 + 400');
s = B.deal(rigged(['S6.0', 'H10.0', 'C5.0', 'D9.0', 'C2.0']));
s = B.doubleDown(s);
assert.equal(s.result.outcome, 'lose');
assert.equal(s.balance, 800, 'thua cả cược gấp đôi');
s = B.deal(rigged(['S6.0', 'H10.0', 'C5.0', 'D7.0', 'C2.0', 'S3.0']));
s = B.hit(s);
assert.ok(!B.canDouble(s), 'không gấp đôi sau khi đã rút');
assert.throws(() => B.doubleDown(s));
s = B.deal(rigged(['S6.0', 'H10.0', 'C5.0', 'D7.0', 'C2.0'], { balance: 150, bet: 100 }));
assert.equal(s.balance, 50);
assert.ok(!B.canDouble(s), 'không đủ điểm để gấp đôi');

// Ván tiếp: giữ mức cược gốc (trước khi gấp đôi), giới hạn theo điểm còn lại.
s = B.deal(rigged(['S6.0', 'H10.0', 'C5.0', 'D9.0', 'C2.0']));
s = B.nextRound(B.doubleDown(s));
assert.equal(s.phase, 'betting');
assert.equal(s.bet, 100);
assert.equal(s.player.length + s.dealer.length, 0);
s = B.deal(rigged(['S10.0', 'H5.0', 'C8.0', 'D6.0', 'C9.0'], { balance: 130, bet: 100 }));
s = B.nextRound(B.hit(s)); // quá 21, thua 100
assert.equal(s.balance, 30);
assert.equal(s.bet, 30, 'cược giảm theo số điểm còn lại');

// Xáo lại giữa các ván khi đã dùng ≥ 75% shoe; không xáo giữa ván.
s = B.createSession(3);
let shuffledAt = null;
for (let round = 0; round < 200 && shuffledAt === null; round++) {
  s.balance = 1000; s.bet = 10;
  const posBefore = s.pos;
  s = B.deal(s);
  if (s.reshuffled) {
    assert.ok(posBefore >= B.RESHUFFLE_AT, 'chỉ xáo khi đã dùng ≥ 75%');
    shuffledAt = round;
    assert.equal(s.shuffles, 1);
    assert.equal(s.pos, s.player.length + s.dealer.length);
  } else {
    assert.ok(posBefore < B.RESHUFFLE_AT);
  }
  while (s.phase === 'player') s = B.handValue(s.player).total < 15 ? B.hit(s) : B.stand(s);
  assert.ok(B.validateSession(s));
  s = B.nextRound(s);
}
assert.ok(shuffledAt > 0);

// Bảo toàn điểm: số dư thay đổi đúng bằng lãi/lỗ của mỗi ván trên nhiều ván ngẫu nhiên.
s = B.createSession(2025, { balance: 100000 });
for (let round = 0; round < 500; round++) {
  s = B.setBet(s, 10 * (1 + (round % 7)));
  const before = s.balance;
  s = B.deal(s);
  while (s.phase === 'player') {
    const t = B.handValue(s.player).total;
    s = t === 11 && B.canDouble(s) ? B.doubleDown(s) : t < 17 ? B.hit(s) : B.stand(s);
  }
  assert.equal(s.balance, before + s.result.net);
  assert.ok(Number.isInteger(s.balance));
  if (s.result.outcome === 'blackjack') assert.equal(s.result.net, (s.bet * 3) / 2);
  if (s.result.outcome === 'win' || s.result.outcome === 'dealer-bust') assert.equal(s.result.net, s.bet);
  if (s.result.outcome === 'push') assert.equal(s.result.net, 0);
  if (['lose', 'bust', 'dealer-blackjack'].includes(s.result.outcome)) assert.equal(s.result.net, -s.bet);
  const d = B.handValue(s.dealer);
  if (!['bust', 'dealer-blackjack', 'blackjack'].includes(s.result.outcome) && !(s.result.outcome === 'push' && B.handValue(s.player).blackjack)) {
    assert.ok(d.total >= 17, 'nhà cái luôn đạt ≥ 17 khi phải rút');
    assert.ok(B.handValue(s.dealer.slice(0, -1)).total < 17 || s.dealer.length === 2, 'nhà cái không rút thêm khi đã ≥ 17');
  }
  s = B.nextRound(s);
}
assert.equal(s.stats.hands, 500);
assert.equal(s.stats.wins + s.stats.losses + s.stats.pushes, 500);

// Lưu/tải: bản sao JSON hợp lệ và giữ nguyên bài; bản lưu hỏng bị từ chối. Chơi lại phiên cùng seed → cùng shoe.
s = B.deal(B.setBet(B.createSession(42), 50));
const copy = JSON.parse(JSON.stringify(s));
assert.ok(B.validateSession(copy));
assert.deepEqual(copy, s);
const broken = JSON.parse(JSON.stringify(s));
broken.shoe[5] = broken.shoe[6];
assert.ok(!B.validateSession(broken));
const foreign = JSON.parse(JSON.stringify(s));
foreign.player.push(foreign.shoe[300]);
assert.ok(!B.validateSession(foreign), 'lá trên tay phải đến từ phần shoe đã chia');
assert.deepEqual(B.createSession(42).shoe, s.shoe);
assert.throws(() => B.setBet(s, 20), 'không đổi cược giữa ván');

console.log('✓ Tất cả kiểm thử Blackjack đều qua');
