// Thành phần giao diện HTML dùng chung: thanh điều hướng, chủ đề màu, hộp thoại, thông báo.
import { GAMES, GROUPS } from './games.js';
import { loadSettings, saveSettings } from './storage.js';

const APP_SETTINGS_DEFAULTS = { theme: 'system' };
const THEME_LABELS = { system: 'Theo hệ thống', light: 'Sáng', dark: 'Tối' };
const THEME_ORDER = ['system', 'light', 'dark'];

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ---------- Chủ đề màu ---------- */

function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event('themechange'));
}

export function initTheme() {
  const settings = loadSettings('app', APP_SETTINGS_DEFAULTS);
  applyTheme(settings.theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    window.dispatchEvent(new Event('themechange'));
  });
  return settings;
}

function cycleTheme(button) {
  const settings = loadSettings('app', APP_SETTINGS_DEFAULTS);
  const next = THEME_ORDER[(THEME_ORDER.indexOf(settings.theme) + 1) % THEME_ORDER.length];
  settings.theme = next;
  saveSettings('app', settings);
  applyTheme(next);
  updateThemeButton(button, next);
  toast(`Giao diện: ${THEME_LABELS[next]}`);
}

const THEME_ICONS = {
  system: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};

function updateThemeButton(button, theme) {
  button.innerHTML = THEME_ICONS[theme];
  button.title = `Giao diện: ${THEME_LABELS[theme]} (bấm để đổi)`;
  button.setAttribute('aria-label', button.title);
}

/** Màu dùng khi vẽ bằng p5, lấy từ biến CSS để đồng bộ với chủ đề sáng/tối. */
export function readThemeColors(names) {
  const style = getComputedStyle(document.documentElement);
  const out = {};
  for (const name of names) out[name] = style.getPropertyValue(`--${name}`).trim() || '#888';
  return out;
}

/* ---------- Thanh điều hướng ---------- */

export function renderNav(activeId = 'home') {
  const header = document.getElementById('site-header');
  if (!header) return;
  const settings = loadSettings('app', APP_SETTINGS_DEFAULTS);
  const themeButton = el('button', { class: 'icon-btn', type: 'button', onclick: () => cycleTheme(themeButton) });
  updateThemeButton(themeButton, settings.theme);

  const link = (g) => el('li', {}, el('a', {
    href: g.href,
    class: activeId === g.id ? 'active' : null,
    'aria-current': activeId === g.id ? 'page' : null,
  }, g.short || g.name));
  // Nhóm đầu hiện thẳng trên thanh; các nhóm sau là menu thả xuống (trên điện thoại: danh sách có tiêu đề).
  const groupMenus = GROUPS.slice(1).map((group) => {
    const games = GAMES.filter((g) => g.group === group.id);
    const active = games.some((g) => g.id === activeId);
    const item = el('li', { class: 'nav-group' });
    const button = el('button', {
      type: 'button', class: `nav-group-btn ${active ? 'active' : ''}`, 'aria-expanded': 'false', 'aria-haspopup': 'true',
      onclick: (e) => {
        e.stopPropagation();
        const open = item.classList.toggle('open');
        button.setAttribute('aria-expanded', String(open));
      },
    }, group.name);
    item.append(button, el('ul', { class: 'nav-sub', 'data-label': group.name }, games.map((g) => el('li', {}, el('a', {
      href: g.href,
      class: activeId === g.id ? 'active' : null,
      'aria-current': activeId === g.id ? 'page' : null,
    }, g.name)))));
    return item;
  });
  const links = el('ul', { class: 'nav-links', id: 'nav-links' },
    el('li', {}, el('a', { href: 'index.html', class: activeId === 'home' ? 'active' : null, 'aria-current': activeId === 'home' ? 'page' : null }, 'Trang chủ')),
    GAMES.filter((g) => g.group === GROUPS[0].id).map(link),
    groupMenus,
  );

  const menuButton = el('button', {
    class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Mở menu', 'aria-expanded': 'false', 'aria-controls': 'nav-links',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    onclick: () => {
      const open = header.classList.toggle('nav-open');
      menuButton.setAttribute('aria-expanded', String(open));
    },
  });

  header.className = 'site-header';
  header.replaceChildren(el('div', { class: 'nav-inner' },
    el('a', { class: 'brand', href: 'index.html' },
      el('span', { class: 'brand-mark', html: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="3"/><rect x="17" y="17" width="12" height="12" rx="3"/><circle cx="23" cy="9" r="6"/><circle cx="9" cy="23" r="6" class="hollow"/></svg>' }),
      el('span', { class: 'brand-text' }, 'Trí Tuệ ', el('b', {}, 'Bàn Cờ'))),
    links,
    el('div', { class: 'nav-actions' }, themeButton, menuButton),
  ));
  // Đóng menu điện thoại khi bấm ra ngoài.
  document.addEventListener('click', (e) => {
    for (const item of header.querySelectorAll('.nav-group.open')) {
      if (!item.contains(e.target)) {
        item.classList.remove('open');
        item.querySelector('.nav-group-btn').setAttribute('aria-expanded', 'false');
      }
    }
    if (header.classList.contains('nav-open') && !header.contains(e.target)) {
      header.classList.remove('nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const item of document.querySelectorAll('.nav-group.open')) {
    item.classList.remove('open');
    item.querySelector('.nav-group-btn')?.setAttribute('aria-expanded', 'false');
  }
});

export function initPage(activeId) {
  initTheme();
  renderNav(activeId);
  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.className = 'site-footer';
    footer.textContent = 'Trí Tuệ Bàn Cờ · Tiến trình được lưu tự động trên trình duyệt này.';
  }
}

/* ---------- Hộp thoại ---------- */

/**
 * Hiển thị hộp thoại modal. `buttons`: [{ label, value, variant }].
 * Trả về Promise với `value` của nút được bấm (hoặc `dismissValue` khi đóng bằng Esc).
 */
export function showDialog({ title, message, buttons = [{ label: 'Đóng', value: true, variant: 'primary' }], dismissValue = null, tone = '', content = null }) {
  return new Promise((resolve) => {
    const dialog = el('dialog', { class: `modal ${tone ? 'modal-' + tone : ''}` });
    const finish = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    const actions = el('div', { class: 'modal-actions' },
      buttons.map((b) => el('button', {
        type: 'button',
        class: `btn ${b.variant ? 'btn-' + b.variant : ''}`,
        onclick: () => finish(b.value),
      }, b.label)));
    dialog.append(...[
      el('h2', { class: 'modal-title' }, title),
      message ? el('p', { class: 'modal-message' }, message) : null,
      content,
      actions,
    ].filter(Boolean));
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(dismissValue); });
    document.body.append(dialog);
    dialog.showModal();
    const primary = actions.querySelector('.btn-primary, .btn-danger') || actions.querySelector('button');
    primary?.focus();
  });
}

export function confirmDialog(title, message, { confirmLabel = 'Đồng ý', cancelLabel = 'Hủy', danger = false } = {}) {
  return showDialog({
    title,
    message,
    dismissValue: false,
    buttons: [
      { label: cancelLabel, value: false, variant: 'ghost' },
      { label: confirmLabel, value: true, variant: danger ? 'danger' : 'primary' },
    ],
  });
}

/** Thông báo kết thúc ván. tone: 'win' | 'lose' | 'draw'. */
export function resultDialog(title, message, tone = 'win', { againLabel = 'Ván mới', viewLabel = 'Xem bàn cờ' } = {}) {
  return showDialog({
    title,
    message,
    tone,
    dismissValue: 'close',
    buttons: [
      { label: viewLabel, value: 'close', variant: 'ghost' },
      { label: againLabel, value: 'again', variant: 'primary' },
    ],
  });
}

/* ---------- Thông báo ngắn ---------- */

let toastHost = null;
export function toast(message, { tone = '', duration = 2200 } = {}) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const node = el('div', { class: `toast ${tone ? 'toast-' + tone : ''}` }, message);
  toastHost.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, duration);
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
}

/** Gắn hành động cho các nút có thuộc tính data-action trong một vùng chứa. */
export function bindActions(root, handlers) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !root.contains(btn) || btn.disabled) return;
    const fn = handlers[btn.dataset.action];
    if (fn) fn(btn, e);
  });
}

export function isDarkTheme() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
