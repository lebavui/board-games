// Điều khiển trang FreeCell.
import { initSolitairePage } from '../../cards/solitaire-page.js';
import { saveSettings } from '../../common/storage.js';
import * as rules from './logic.js';
import { freecellScene } from './view.js';

const page = initSolitairePage({
  id: 'freecell',
  rules,
  scene: freecellScene,
  defaultOptions: {},
  optionKey: null,
  optionLabel: () => 'FreeCell',
  extraSettings: { autoplay: true },
  postMove: (state, settings) => (settings.autoplay ? rules.autoplay(state) : state),
});

const box = document.getElementById('opt-autoplay');
box.checked = !!page.settings.autoplay;
box.addEventListener('change', () => {
  page.settings.autoplay = box.checked;
  saveSettings('freecell', page.settings);
});
