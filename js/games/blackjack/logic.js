// Luật Blackjack — thuần dữ liệu, không DOM, không p5. CHỈ DÙNG ĐIỂM ẢO, không có tiền thật.
//
// - Shoe 6 bộ (312 lá); xáo lại giữa các ván khi đã dùng 75% shoe.
// - Nhà cái dừng ở mọi tổng 17 (kể cả soft 17). Nhà cái kiểm tra Blackjack (peek) khi lá ngửa là A hoặc lá 10 điểm.
// - Blackjack tự nhiên trả 3:2, thắng thường 1:1, hòa trả lại cược. Có Hit, Stand, Double Down (chỉ với 2 lá đầu).
// - Cược là bội số của 10 điểm nên khoản trả 3:2 luôn là số nguyên điểm (10 → 15), không có làm tròn.
import { createDeck, createRng, shuffle, mixSeed, cardOf, verifyPiles, cloneState } from '../../cards/deck.js';

export const DECKS = 6;
export const START_BALANCE = 1000;
export const MIN_BET = 10;
export const BET_UNIT = 10;
export const PENETRATION = 0.75;
export const SHOE_IDS = createDeck({ decks: DECKS }).map((c) => c.id);
export const RESHUFFLE_AT = Math.floor(SHOE_IDS.length * PENETRATION); // 234 lá

/** A = 1 (hoặc 11 trong handValue), J/Q/K = 10, còn lại theo hạng. */
export function cardValue(id) {
  const r = cardOf(id).rank;
  return r >= 10 ? 10 : r;
}

/** Tổng điểm tay bài: { total, soft (có A đang tính 11), blackjack (A + lá 10 điểm trong đúng 2 lá đầu), bust }. */
export function handValue(ids) {
  let total = 0, aces = 0;
  for (const id of ids) {
    const v = cardValue(id);
    total += v;
    if (v === 1) aces++;
  }
  const soft = aces > 0 && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft, blackjack: ids.length === 2 && total === 21, bust: total > 21 };
}

export function newShoe(seed, shuffles) {
  return shuffle(SHOE_IDS, createRng(mixSeed(seed, shuffles)));
}

export function createSession(seed, { balance = START_BALANCE } = {}) {
  return {
    seed, shuffles: 0, shoe: newShoe(seed, 0), pos: 0,
    balance, bet: Math.min(MIN_BET * 5, maxBet(balance)), baseBet: 0,
    phase: 'betting', player: [], dealer: [], holeHidden: false, doubled: false, result: null, reshuffled: false,
    stats: { hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, net: 0, peak: balance },
  };
}

export const maxBet = (balance) => Math.floor(balance / BET_UNIT) * BET_UNIT;
export const remainingInShoe = (s) => s.shoe.length - s.pos;
export const needsShuffle = (s) => s.pos >= RESHUFFLE_AT;
export const isBroke = (s) => s.phase === 'betting' && s.balance < MIN_BET;

export function isValidBet(s, amount) {
  return Number.isInteger(amount) && amount >= MIN_BET && amount % BET_UNIT === 0 && amount <= s.balance;
}

/** Đặt mức cược (chỉ khi đang chờ cược). */
export function setBet(s, amount) {
  if (s.phase !== 'betting') throw new Error('Chỉ đặt cược trước khi chia bài');
  if (amount !== 0 && !isValidBet(s, amount)) throw new Error('Mức cược không hợp lệ');
  return { ...s, bet: amount };
}

function draw(s) {
  return s.shoe[s.pos++];
}

function settle(s) {
  s.holeHidden = false;
  const p = handValue(s.player), d = handValue(s.dealer);
  let outcome, payout;
  if (p.bust) [outcome, payout] = ['bust', 0];
  else if (p.blackjack && d.blackjack) [outcome, payout] = ['push', s.bet];
  else if (p.blackjack) [outcome, payout] = ['blackjack', s.bet + (s.bet * 3) / 2];
  else if (d.blackjack) [outcome, payout] = ['dealer-blackjack', 0];
  else if (d.bust) [outcome, payout] = ['dealer-bust', s.bet * 2];
  else if (p.total > d.total) [outcome, payout] = ['win', s.bet * 2];
  else if (p.total < d.total) [outcome, payout] = ['lose', 0];
  else [outcome, payout] = ['push', s.bet];
  s.balance += payout;
  s.result = { outcome, payout, net: payout - s.bet, player: p.total, dealer: d.total };
  s.phase = 'done';
  const st = s.stats;
  st.hands++;
  st.net += payout - s.bet;
  if (outcome === 'push') st.pushes++;
  else if (payout > 0) st.wins++;
  else st.losses++;
  if (outcome === 'blackjack') st.blackjacks++;
  st.peak = Math.max(st.peak, s.balance);
  return s;
}

/** Nhà cái lật lá úp và rút tới khi đạt ít nhất 17 (dừng cả ở soft 17). */
function dealerPlay(s) {
  s.holeHidden = false;
  while (handValue(s.dealer).total < 17) s.dealer.push(draw(s));
  return settle(s);
}

/** Chia ván mới với mức cược hiện tại: người chơi, nhà cái (ngửa), người chơi, nhà cái (úp). */
export function deal(state) {
  if (state.phase !== 'betting') throw new Error('Ván đang diễn ra');
  if (!isValidBet(state, state.bet)) throw new Error('Mức cược không hợp lệ');
  const s = cloneState(state);
  s.reshuffled = false;
  if (needsShuffle(s)) {
    s.shuffles++;
    s.shoe = newShoe(s.seed, s.shuffles);
    s.pos = 0;
    s.reshuffled = true;
  }
  s.balance -= s.bet;
  s.baseBet = s.bet;
  s.doubled = false;
  s.result = null;
  s.player = [draw(s)];
  s.dealer = [draw(s)];
  s.player.push(draw(s));
  s.dealer.push(draw(s));
  s.holeHidden = true;
  const upValue = cardValue(s.dealer[0]);
  // Nhà cái kiểm tra Blackjack trước khi người chơi hành động nếu lá ngửa là A hoặc lá 10 điểm.
  if ((upValue === 1 || upValue === 10) && handValue(s.dealer).blackjack) return settle(s);
  if (handValue(s.player).blackjack) return settle(s);
  s.phase = 'player';
  return s;
}

export const canHit = (s) => s.phase === 'player';
export const canStand = (s) => s.phase === 'player';
export const canDouble = (s) => s.phase === 'player' && s.player.length === 2 && !s.doubled && s.balance >= s.bet;

export function hit(state) {
  if (!canHit(state)) throw new Error('Không thể rút bài lúc này');
  const s = cloneState(state);
  s.player.push(draw(s));
  const v = handValue(s.player);
  if (v.bust) return settle(s);          // quá 21: thua ngay, nhà cái không cần rút
  if (v.total === 21) return dealerPlay(s); // 21 điểm: tự dừng
  return s;
}

export function stand(state) {
  if (!canStand(state)) throw new Error('Không thể dừng lúc này');
  return dealerPlay(cloneState(state));
}

/** Gấp đôi: chỉ với 2 lá đầu, cần đủ điểm; cược gấp đôi, nhận đúng một lá rồi dừng. */
export function doubleDown(state) {
  if (!canDouble(state)) throw new Error('Không thể gấp đôi lúc này');
  const s = cloneState(state);
  s.balance -= s.bet;
  s.bet *= 2;
  s.doubled = true;
  s.player.push(draw(s));
  if (handValue(s.player).bust) return settle(s);
  return dealerPlay(s);
}

/** Dọn bàn cho ván tiếp: giữ mức cược cũ nếu còn đủ điểm. */
export function nextRound(state) {
  if (state.phase !== 'done') throw new Error('Ván chưa kết thúc');
  const s = cloneState(state);
  Object.assign(s, { phase: 'betting', player: [], dealer: [], holeHidden: false, doubled: false, result: null, reshuffled: false });
  s.bet = Math.min(s.baseBet || MIN_BET, maxBet(s.balance));
  if (s.bet < MIN_BET) s.bet = 0;
  return s;
}

/** Kiểm tra bản lưu: shoe đúng 312 lá không trùng, bài trên tay lấy từ phần shoe đã dùng, điểm hợp lệ. */
export function validateSession(s) {
  if (!s || typeof s !== 'object' || !Number.isInteger(s.seed) || !Array.isArray(s.shoe)) return false;
  if (!verifyPiles({ shoe: s.shoe }, SHOE_IDS)) return false;
  if (!Number.isInteger(s.pos) || s.pos < 0 || s.pos > s.shoe.length) return false;
  if (!['betting', 'player', 'done'].includes(s.phase)) return false;
  if (!Number.isFinite(s.balance) || s.balance < 0 || !Number.isFinite(s.bet)) return false;
  const used = new Set(s.shoe.slice(0, s.pos));
  return [...s.player, ...s.dealer].every((id) => used.has(id));
}
