// Điều khiển trang Klondike.
import { initSolitairePage } from '../../cards/solitaire-page.js';
import * as rules from './logic.js';
import { klondikeScene } from './view.js';

initSolitairePage({
  id: 'klondike',
  rules,
  scene: klondikeScene,
  defaultOptions: { draw: 1 },
  optionKey: 'draw',
  optionLabel: (o) => (o.draw === 3 ? 'Rút 3 lá' : 'Rút 1 lá'),
  tapPile: (state) => rules.drawStock(state),
  finisher: { can: rules.canAutoFinish, next: rules.nextFinishMove },
});
