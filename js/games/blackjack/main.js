// Điều khiển trang Blackjack — chỉ điểm ảo, không có tiền thật. Không có hoàn tác sau khi đã chia bài.
import { initPage, confirmDialog, bindActions, toast } from '../../common/ui.js';
import { load, save } from '../../common/storage.js';
import { randomSeed } from '../../cards/deck.js';
import { createCardTable } from '../../cards/card-table.js';
import * as B from './logic.js';
import { blackjackScene, drawBlackjackOverlay, formatPoints, outcomeText } from './view.js';

const SAVE_KEY = 'blackjack:session';
const SAVE_VERSION = 1;

initPage('blackjack');
const $ = (id) => document.getElementById(id);

let state = restore() || B.createSession(randomSeed());
let busyUntil = 0;
let busyTimer = null;

function restore() {
  const data = load(SAVE_KEY, { version: SAVE_VERSION });
  return B.validateSession(data) ? data : null;
}
const persist = () => save(SAVE_KEY, state, SAVE_VERSION);

const table = createCardTable($('board'), {
  reserveHeight: 150, // chừa chỗ cho nút cược / hành động bên dưới bàn
  minHeight: 300,
  scene: (w, h) => blackjackScene(state, w, h),
  overlay: (p, scene, colors, api) => drawBlackjackOverlay(p, scene, colors, api, state, B.remainingInShoe(state)),
});

/** Áp dụng trạng thái mới và chạy hoạt ảnh; khóa nút hành động cho tới khi bài đã chia xong. */
function update(next, anim = {}) {
  state = next;
  persist();
  const wait = table.refresh(anim);
  busyUntil = performance.now() + wait;
  clearTimeout(busyTimer);
  render();
  busyTimer = setTimeout(render, wait + 30);
}

const busy = () => performance.now() < busyUntil;

function render() {
  const s = state;
  const locked = busy();
  $('balance').textContent = formatPoints(s.balance);
  $('bet').textContent = formatPoints(s.bet);
  $('shoe').textContent = `${B.remainingInShoe(s)} lá${B.needsShuffle(s) && s.phase !== 'player' ? ' · xáo lại ở ván tới' : ''}`;
  $('bet-controls').hidden = s.phase !== 'betting';
  $('play-controls').hidden = s.phase !== 'player';
  $('done-controls').hidden = s.phase !== 'done';
  document.querySelectorAll('[data-action="chip"]').forEach((b) => { b.disabled = s.bet + Number(b.dataset.value) > s.balance; });
  $('btn-all-in').disabled = B.maxBet(s.balance) < B.MIN_BET || s.bet === B.maxBet(s.balance);
  $('btn-clear').disabled = s.bet === 0;
  $('btn-deal').disabled = !B.isValidBet(s, s.bet);
  $('btn-hit').disabled = locked || !B.canHit(s);
  $('btn-stand').disabled = locked || !B.canStand(s);
  $('btn-double').disabled = locked || !B.canDouble(s);
  $('btn-double').title = s.phase === 'player' && s.player.length === 2 && s.balance < s.bet
    ? 'Không đủ điểm để gấp đôi'
    : 'Gấp đôi cược, nhận đúng một lá rồi dừng (phím D)';
  const nextBet = Math.min(s.baseBet || B.MIN_BET, B.maxBet(s.balance));
  $('btn-again').disabled = locked || nextBet < B.MIN_BET;
  $('btn-again').textContent = nextBet >= B.MIN_BET ? `Chia ván tiếp · cược ${formatPoints(nextBet)}` : 'Hết điểm';
  $('btn-rebet').disabled = locked;

  const msg = $('message');
  msg.className = 'bj-message';
  if (s.phase === 'betting') {
    if (s.balance < B.MIN_BET) msg.textContent = `Bạn đã hết điểm ảo. Bắt đầu phiên mới để nhận lại ${formatPoints(B.START_BALANCE)} điểm.`;
    else if (s.bet) msg.textContent = `Cược ${formatPoints(s.bet)} điểm — bấm “Chia bài”.`;
    else msg.textContent = `Chọn mức cược (tối thiểu ${B.MIN_BET}, bội số của ${B.BET_UNIT}).`;
  } else if (s.phase === 'player') {
    msg.textContent = 'Rút thêm (Hit), dừng (Stand) hay gấp đôi (Double)?';
  } else if (!locked) {
    const { title, tone, net } = outcomeText(s.result);
    msg.textContent = `${title}: bạn ${s.result.player} – nhà cái ${s.result.dealer} · ${net} điểm`;
    msg.className = `bj-message ${tone === 'win' ? 'ok' : tone === 'lose' ? 'bad' : ''}`;
  } else {
    msg.textContent = 'Nhà cái đang chơi…';
  }

  const st = s.stats;
  $('stat-hands').textContent = st.hands;
  $('stat-wld').textContent = `${st.wins} / ${st.losses} / ${st.pushes}`;
  $('stat-bj').textContent = st.blackjacks;
  $('stat-net').textContent = (st.net > 0 ? '+' : st.net < 0 ? '−' : '') + formatPoints(Math.abs(st.net));
  $('stat-peak').textContent = formatPoints(st.peak);
  $('stat-seed').textContent = `#${s.seed}`;
}

/* ---------- Hành động ---------- */

function addChip(value) {
  if (state.phase !== 'betting') return;
  const amount = state.bet + value;
  if (amount > state.balance) { toast('Không đủ điểm cho mức cược này'); return; }
  update(B.setBet(state, amount));
}

function dealRound() {
  if (state.phase !== 'betting' || !B.isValidBet(state, state.bet)) return;
  const next = B.deal(state);
  if (next.reshuffled) toast('Đã dùng 75% shoe — xáo lại 6 bộ bài');
  update(next, { stagger: 260 });
}

function act(fn, check) {
  if (busy() || !check(state)) return;
  const prevDealer = state.dealer.length;
  const wasHidden = state.holeHidden;
  const next = fn(state);
  const dealerDrew = next.dealer.length > prevDealer;
  // Nhà cái lật lá úp trước, rồi rút từng lá một.
  update(next, { stagger: dealerDrew ? 480 : 0, delay: dealerDrew && wasHidden ? 380 : 0 });
}

function again(redeal) {
  if (busy() || state.phase !== 'done') return;
  const next = B.nextRound(state);
  if (redeal && B.isValidBet(next, next.bet)) {
    state = next;
    dealRound();
  } else {
    update(next);
  }
}

async function newSession(sameSeed) {
  const inRound = state.phase === 'player';
  const ok = await confirmDialog(
    sameSeed ? 'Chơi lại phiên này?' : 'Bắt đầu phiên mới?',
    `${inRound ? 'Ván đang chơi sẽ bị bỏ. ' : ''}Điểm ảo trở về ${formatPoints(B.START_BALANCE)} và thống kê được đặt lại.`
      + (sameSeed ? ' Shoe được xáo đúng như lúc đầu phiên, nên bài ra theo cùng thứ tự.' : ' Shoe mới được xáo ngẫu nhiên.'),
    { confirmLabel: sameSeed ? 'Chơi lại' : 'Phiên mới', danger: state.stats.hands > 0 || inRound },
  );
  if (!ok) return;
  update(B.createSession(sameSeed ? state.seed : randomSeed()));
}

bindActions(document.querySelector('.game-layout'), {
  chip: (btn) => addChip(Number(btn.dataset.value)),
  'all-in': () => { if (state.phase === 'betting') update(B.setBet(state, B.maxBet(state.balance))); },
  clear: () => { if (state.phase === 'betting') update(B.setBet(state, 0)); },
  deal: dealRound,
  hit: () => act(B.hit, B.canHit),
  stand: () => act(B.stand, B.canStand),
  double: () => act(B.doubleDown, B.canDouble),
  again: () => again(true),
  rebet: () => again(false),
  'new-session': () => newSession(false),
  'restart-session': () => newSession(true),
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'enter' && e.target.closest('button')) return; // Enter trên nút: để trình duyệt bấm nút đó
  if (k === 'h') act(B.hit, B.canHit);
  else if (k === 's') act(B.stand, B.canStand);
  else if (k === 'd') act(B.doubleDown, B.canDouble);
  else if (k === 'enter') {
    if (state.phase === 'betting') dealRound();
    else if (state.phase === 'done') again(true);
  }
});

window.addEventListener('pagehide', persist);
table.refresh({ instant: true });
render();
