// Bộ chọn chế độ chơi dùng chung cho các trò hai người: Hai người / Chơi với máy,
// bên người chơi cầm và độ khó của máy.
import { el } from './ui.js';

export const AI_LEVEL_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

export function defaultOpponent(humanSide) {
  return { mode: 'pvp', human: humanSide, level: 'medium' };
}

/** Kiểm tra cấu hình đọc từ localStorage; trả về cấu hình hợp lệ. */
export function sanitizeOpponent(value, sides, fallback) {
  const v = value && typeof value === 'object' ? value : {};
  return {
    mode: v.mode === 'ai' ? 'ai' : 'pvp',
    human: sides.includes(v.human) ? v.human : fallback.human,
    level: v.level in AI_LEVEL_LABELS ? v.level : fallback.level,
  };
}

function segmented(group, label, options) {
  return el('div', { class: 'segmented', role: 'group', 'aria-label': label, 'data-group': group },
    options.map(([value, text]) => el('button', { type: 'button', 'data-value': value, 'aria-pressed': 'false' }, text)));
}

/**
 * Vẽ bộ chọn vào `root`.
 * - sides: [[giá trị, nhãn], ...] hai bên quân
 * - onChange(field, value): trang tự xử lý (xác nhận, ván mới…) rồi gọi update(config)
 * Trả về { update(config) }.
 */
export function mountOpponentControls(root, { sides, onChange }) {
  const options = el('div', { class: 'ai-options' },
    el('div', { class: 'field' }, el('span', {}, 'Bạn cầm quân'), segmented('human', 'Bên của bạn', sides)),
    el('div', { class: 'field' }, el('span', {}, 'Độ khó của máy'),
      segmented('level', 'Độ khó của máy', Object.entries(AI_LEVEL_LABELS))));
  root.replaceChildren(
    el('h2', {}, 'Chế độ chơi'),
    segmented('mode', 'Chế độ chơi', [['pvp', 'Hai người'], ['ai', 'Chơi với máy']]),
    options,
  );
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-group] button');
    if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
    onChange(btn.parentElement.dataset.group, btn.dataset.value);
  });
  return {
    update(config) {
      for (const group of ['mode', 'human', 'level']) {
        root.querySelectorAll(`[data-group="${group}"] button`).forEach((b) => {
          b.setAttribute('aria-pressed', String(b.dataset.value === config[group]));
        });
      }
      options.hidden = config.mode !== 'ai';
    },
  };
}
