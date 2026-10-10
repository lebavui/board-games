// Điều khiển trang Spider Solitaire.
import { initSolitairePage } from '../../cards/solitaire-page.js';
import * as rules from './logic.js';
import { spiderScene } from './view.js';

const LABELS = { 1: 'Một chất', 2: 'Hai chất', 4: 'Bốn chất' };

initSolitairePage({
  id: 'spider',
  rules,
  scene: spiderScene,
  defaultOptions: { suits: 1 },
  optionKey: 'suits',
  optionLabel: (o) => LABELS[o.suits],
  tapPile: (state) => rules.dealRow(state) ?? 'Đã chia hết bài',
  onChange: (state) => {
    document.getElementById('runs').textContent = `${rules.completedRuns(state)}/8`;
    document.getElementById('deals').textContent = String(Math.floor(state.piles.stock.length / 10));
  },
});
