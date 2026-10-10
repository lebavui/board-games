// Bố cục và phần vẽ thêm của bàn Blackjack (shoe, tổng điểm, kết quả). Lá bài do card-table vẽ.
import { handValue } from './logic.js';
import { drawCard } from '../../cards/card-render.js';

export function formatPoints(n) {
  return n.toLocaleString('vi-VN');
}

function handPositions(ids, left, right, y, cardW) {
  const n = ids.length;
  const room = right - left;
  const step = n > 1 ? Math.min(cardW * 0.9, (room - cardW) / (n - 1)) : 0;
  const total = cardW + (n - 1) * step;
  const x0 = left + (room - total) / 2;
  // Lá bị che quá nửa phải: thêm chất nhỏ ở mép trái để vẫn đọc được hạng và chất.
  const sideIndex = step < cardW * 0.8;
  return ids.map((id, i) => ({ id, x: x0 + i * step, y, sideIndex }));
}

export function blackjackScene(state, availW, availH) {
  const width = availW;
  const height = Math.max(300, Math.min(availH, 540));
  const cardW = Math.round(Math.max(48, Math.min(100, width / 6.2, height / 4.3)));
  const cardH = Math.round(cardW * 1.4);
  const pad = 12;
  const shoe = { x: width - cardW - pad - 4, y: pad + 6 };
  const labelH = Math.max(22, cardW * 0.3);
  const dealerY = pad + labelH + 4;
  const playerY = height - cardH - pad - labelH - 2;
  const cards = [];
  const dealerRight = width < 560 ? shoe.x - 6 : width - pad;
  handPositions(state.dealer, pad, dealerRight, dealerY, cardW).forEach((c, i) => {
    cards.push({ ...c, up: !(i === 1 && state.holeHidden), pile: 'dealer', index: i });
  });
  handPositions(state.player, pad, width - pad, playerY, cardW).forEach((c, i) => {
    cards.push({ ...c, up: true, pile: 'player', index: i });
  });
  return { width, height, cardW, cardH, slots: [], cards, zones: [], origin: { x: shoe.x + 4, y: shoe.y + 6 }, shoe, dealerY, playerY, labelH };
}

const OUTCOME = {
  blackjack: ['Blackjack!', 'win'],
  win: ['Thắng', 'win'],
  'dealer-bust': ['Nhà cái quá 21 · Thắng', 'win'],
  push: ['Hòa · hoàn cược', 'push'],
  lose: ['Thua', 'lose'],
  bust: ['Quá 21 · Thua', 'lose'],
  'dealer-blackjack': ['Nhà cái có Blackjack · Thua', 'lose'],
};

export function outcomeText(result) {
  const [title, tone] = OUTCOME[result.outcome];
  const net = result.net > 0 ? `+${formatPoints(result.net)}` : result.net < 0 ? `−${formatPoints(-result.net)}` : '±0';
  return { title, tone, net };
}

function totalLabel(ids, hiddenCount) {
  if (!ids.length) return hiddenCount ? '?' : '';
  const v = handValue(ids);
  let text = v.soft && v.total < 21 ? `${v.total - 10}/${v.total}` : String(v.total);
  if (v.blackjack && !hiddenCount) text = 'Blackjack';
  return hiddenCount ? `${text} + ?` : text;
}

function badge(p, x, y, text, colors, { size = 14, fill = 'rgba(0,0,0,0.38)', color = '#ffffff' } = {}) {
  p.textSize(size);
  p.textStyle(p.BOLD);
  const w = p.textWidth(text) + size * 1.1;
  const h = size * 1.75;
  p.noStroke();
  p.fill(fill);
  p.rect(x, y, w, h, h / 2);
  p.fill(color);
  p.textAlign(p.LEFT, p.CENTER);
  p.text(text, x + size * 0.55, y + h / 2 + 1);
  p.textStyle(p.NORMAL);
  return w;
}

/** Vẽ shoe, nhãn và tổng điểm (chỉ tính các lá đã tới nơi), và băng kết quả khi mọi lá đã yên vị. */
export function drawBlackjackOverlay(p, scene, colors, api, state, remaining) {
  const { cardW, cardH, shoe, labelH } = scene;
  const fs = Math.max(12, Math.min(16, cardW * 0.2));

  // Shoe: hộp đựng bài, lá úp trên cùng lộ ra khỏi miệng hộp.
  const boxH = cardH * 0.62;
  p.push();
  p.noStroke();
  p.fill(0, 0, 0, 70);
  p.rect(shoe.x - 4, shoe.y - 4, cardW + 12, boxH + 8, 8);
  drawCard(p, 'S1.0', shoe.x + 2, shoe.y + 2, cardW, cardH * 0.5, colors, { up: false });
  p.fill(colors.felt);
  p.rect(shoe.x - 4, shoe.y + cardH * 0.36, cardW + 12, boxH - cardH * 0.36 + 4, 0, 0, 8, 8);
  p.fill(0, 0, 0, 95);
  p.rect(shoe.x - 4, shoe.y + cardH * 0.36, cardW + 12, boxH - cardH * 0.36 + 4, 0, 0, 8, 8);
  p.fill(255, 255, 255, 225);
  p.textAlign(p.CENTER, p.CENTER);
  p.textStyle(p.BOLD);
  p.textSize(Math.max(10, fs * 0.72));
  p.text(`${remaining} lá`, shoe.x + cardW / 2 + 2, shoe.y + (cardH * 0.36 + boxH) / 2 + 2);
  p.textStyle(p.NORMAL);
  p.pop();

  const settled = (pile) => scene.cards.filter((c) => c.pile === pile && api.isSettled(c.id));
  const dealerShown = settled('dealer');
  const visible = dealerShown.filter((c) => c.up).map((c) => c.id);
  const hidden = state.dealer.length ? dealerShown.length - visible.length + (state.dealer.length - dealerShown.length) : 0;
  const pIds = settled('player').map((c) => c.id);
  const pad = 12;
  if (state.dealer.length) {
    const w = badge(p, pad, scene.dealerY - labelH - 2, 'Nhà cái', colors, { size: fs * 0.85, fill: 'rgba(0,0,0,0.0)' });
    if (dealerShown.length) badge(p, pad + w, scene.dealerY - labelH - 2, totalLabel(visible, hidden), colors, { size: fs * 0.85 });
  } else {
    // Chưa chia bài: ghi luật chính ở giữa bàn.
    const boxW = Math.min(scene.width - 32, 420);
    p.fill(255, 255, 255, 160);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(fs);
    p.text('Nhà cái dừng ở mọi tổng 17\nBlackjack trả 3:2 · thắng thường 1:1',(scene.width - boxW) / 2, scene.height / 2 - fs * 2, boxW, fs * 4);
  }
  const py = scene.playerY + cardH + 4;
  if (state.player.length) {
    const w = badge(p, pad, py, 'Bạn', colors, { size: fs * 0.85, fill: 'rgba(0,0,0,0.0)' });
    const w2 = pIds.length ? badge(p, pad + w, py, totalLabel(pIds, 0), colors, { size: fs * 0.85 }) : 0;
    if (state.doubled) badge(p, pad + w + w2 + 6, py, 'Gấp đôi', colors, { size: fs * 0.8, fill: 'rgba(245,158,11,0.9)', color: '#1b1300' });
  }

  const allSettled = scene.cards.every((c) => api.isSettled(c.id));
  if (state.phase === 'done' && state.result && allSettled) {
    const { title, tone, net } = outcomeText(state.result);
    const fill = tone === 'win' ? 'rgba(21,128,61,0.94)' : tone === 'lose' ? 'rgba(185,28,28,0.94)' : 'rgba(180,83,9,0.94)';
    const text = `${title}  ${net}`;
    p.textSize(Math.max(16, Math.min(24, scene.width / 22)));
    p.textStyle(p.BOLD);
    const w = Math.min(scene.width - 24, p.textWidth(text) + 40);
    const h = Math.max(40, Math.min(56, scene.width / 14));
    const cy = (scene.dealerY + cardH + scene.playerY) / 2;
    p.noStroke();
    p.fill(0, 0, 0, 60);
    p.rect((scene.width - w) / 2 + 2, cy - h / 2 + 4, w, h, 12);
    p.fill(fill);
    p.rect((scene.width - w) / 2, cy - h / 2, w, h, 12);
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(text, scene.width / 2, cy + 1);
    p.textStyle(p.NORMAL);
  }
}
