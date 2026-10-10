// Trang chủ: hiển thị thẻ trò chơi kèm trạng thái ván đã lưu.
import { initPage, el } from './common/ui.js';
import { load } from './common/storage.js';
import { GAMES, GROUPS } from './common/games.js';

initPage('home');


// Lá bài thu nhỏ cho ảnh minh họa game bài (SVG thuần, không dùng ảnh ngoài).
const SUIT_PATHS = {
  S: 'M0-6C3-2 6 0 6 2.6 6 5 3.4 6 1.2 4.4L2 8H-2L-1.2 4.4C-3.4 6-6 5-6 2.6-6 0-3-2 0-6Z',
  H: 'M0 6C-3 3-6 0.6-6-2.2-6-4.6-3-6 0-3 3-6 6-4.6 6-2.2 6 0.6 3 3 0 6Z',
  D: 'M0-6L4.5 0 0 6-4.5 0Z',
  C: 'M0-6.4A2.8 2.8 0 1 1 0-0.8 2.8 2.8 0 1 1 0-6.4ZM-3.2-1.6A2.8 2.8 0 1 1-3.2 4 2.8 2.8 0 1 1-3.2-1.6ZM3.2-1.6A2.8 2.8 0 1 1 3.2 4 2.8 2.8 0 1 1 3.2-1.6ZM-1 1H1L2 7H-2Z',
};
function miniCard(x, y, rank, suit, rot = 0) {
  const color = suit === 'H' || suit === 'D' ? '#c8102e' : '#15171c';
  if (!rank) {
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="26" height="36" rx="3" fill="#3f3ab8" stroke="#1e1b6b"/><rect x="3" y="3" width="20" height="30" rx="2" fill="none" stroke="#c7c9ff"/></g>`;
  }
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect width="26" height="36" rx="3" fill="#fff" stroke="#8b93a3"/>
    <text x="3" y="10" font-family="sans-serif" font-weight="700" font-size="9" fill="${color}">${rank}</text>
    <path d="${SUIT_PATHS[suit]}" transform="translate(19 6.5) scale(0.55)" fill="${color}"/>
    <path d="${SUIT_PATHS[suit]}" transform="translate(13 23) scale(1.1)" fill="${color}"/></g>`;
}
const felt = (inner) => `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="8" fill="#1d6b47"/>${inner}</svg>`;

const THUMBS = {
  sudoku: `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="6" fill="var(--surface)" stroke="var(--grid-strong)" stroke-width="2.5"/>
    <path d="M31 2v86M59 2v86M2 31h86M2 59h86" stroke="var(--grid-strong)" stroke-width="2"/>
    <path d="M12 2v86M21 2v86M40 2v86M50 2v86M69 2v86M78 2v86M2 12h86M2 21h86M2 40h86M2 50h86M2 69h86M2 78h86" stroke="var(--grid-line)" stroke-width="0.8"/>
    <g font-family="sans-serif" font-weight="700" font-size="8" fill="var(--given)" text-anchor="middle"><text x="7" y="10">5</text><text x="26" y="19">3</text><text x="45" y="48">7</text><text x="74" y="29">9</text><text x="16" y="67">1</text><text x="64" y="76">4</text><text x="83" y="57">2</text></g>
    <g font-family="sans-serif" font-size="8" fill="var(--user-digit)" text-anchor="middle"><text x="54" y="19">6</text><text x="35" y="67">8</text></g>
    <rect x="41" y="41" width="8" height="8" fill="var(--accent)" opacity="0.25"/></svg>`,
  kakuro: `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="6" fill="var(--block)"/>
    <g fill="var(--surface)"><rect x="24" y="24" width="20" height="20" rx="2"/><rect x="46" y="24" width="20" height="20" rx="2"/><rect x="24" y="46" width="20" height="20" rx="2"/><rect x="46" y="46" width="20" height="20" rx="2"/><rect x="68" y="46" width="18" height="20" rx="2"/><rect x="46" y="68" width="20" height="18" rx="2"/></g>
    <g stroke="var(--block-text)" stroke-width="0.8" opacity="0.5"><path d="M2 24l20 20M24 2l20 20M46 2l20 20M2 46l20 20"/></g>
    <g font-family="sans-serif" font-weight="700" font-size="7" fill="var(--block-text)"><text x="13" y="31">16</text><text x="26" y="20">4</text><text x="48" y="20">12</text><text x="13" y="53">10</text></g>
    <g font-family="sans-serif" font-weight="700" font-size="11" fill="var(--user-digit)" text-anchor="middle"><text x="34" y="38">7</text><text x="56" y="38">9</text><text x="34" y="60">3</text></g></svg>`,
  minesweeper: `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="6" fill="var(--mine-open)" stroke="var(--grid-line)"/>
    <g fill="var(--mine-hidden)"><rect x="47" y="4" width="19" height="19" rx="3"/><rect x="68" y="4" width="18" height="19" rx="3"/><rect x="68" y="25" width="18" height="19" rx="3"/><rect x="4" y="68" width="19" height="18" rx="3"/><rect x="25" y="68" width="19" height="18" rx="3"/><rect x="68" y="68" width="18" height="18" rx="3"/></g>
    <g font-family="sans-serif" font-weight="800" font-size="13" text-anchor="middle"><text x="35" y="19" fill="#2563eb">1</text><text x="56" y="40" fill="#15803d">2</text><text x="35" y="61" fill="#2563eb">1</text><text x="56" y="61" fill="#dc2626">3</text></g>
    <path d="M73 9v12" stroke="var(--text)" stroke-width="1.5"/><path d="M73 9l9 4-9 4z" fill="#ef4444"/>
    <circle cx="77" cy="77" r="5" fill="var(--text)"/><path d="M77 70v14M70 77h14" stroke="var(--text)" stroke-width="1.5"/></svg>`,
  chess: `<svg viewBox="0 0 90 90"><g>${[...Array(16)].map((_, k) => `<rect x="${2 + (k % 4) * 21.5}" y="${2 + Math.floor(k / 4) * 21.5}" width="21.5" height="21.5" fill="${(k % 4 + Math.floor(k / 4)) % 2 ? '#b58863' : '#eedfc7'}"/>`).join('')}</g>
    <g stroke="#24222b" stroke-width="1.6" fill="#fbf9f2"><path d="M30 80h20v-5H30z"/><path d="M33 75l-4-24 7 12 4-18 4 18 7-12-4 24z"/><circle cx="29" cy="50" r="2.5"/><circle cx="40" cy="44" r="2.5"/><circle cx="51" cy="50" r="2.5"/></g>
    <g stroke="#0e0d12" stroke-width="1.6" fill="#2b2933"><path d="M52 40h20v-5H52z"/><path d="M55 35c-3-6 0-12 7-12s10 6 7 12z"/><path d="M60 23h4v-9h-4zM57 16h10v3H57z"/></g></svg>`,
  checkers: `<svg viewBox="0 0 90 90"><g>${[...Array(16)].map((_, k) => `<rect x="${2 + (k % 4) * 21.5}" y="${2 + Math.floor(k / 4) * 21.5}" width="21.5" height="21.5" fill="${(k % 4 + Math.floor(k / 4)) % 2 ? '#7b5234' : '#f1e2c4'}"/>`).join('')}</g>
    <g><circle cx="34" cy="12.7" r="8" fill="#2a2830" stroke="#0f0e12"/><circle cx="77" cy="12.7" r="8" fill="#2a2830" stroke="#0f0e12"/><circle cx="55.5" cy="34.2" r="8" fill="#2a2830" stroke="#0f0e12"/>
    <circle cx="12.7" cy="77" r="8" fill="#c43a32" stroke="#6d1612"/><circle cx="55.5" cy="77" r="8" fill="#c43a32" stroke="#6d1612"/><circle cx="34" cy="55.5" r="8" fill="#c43a32" stroke="#6d1612"/>
    <path d="M29 57l1-5 2.5 3 1.5-4 1.5 4 2.5-3 1 5z" fill="#f5c542"/></g></svg>`,
  gomoku: `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="6" fill="#e3b873"/>
    <g stroke="#5b3f1d" stroke-width="0.9">${[...Array(8)].map((_, k) => `<path d="M${10 + k * 10} 10v70M10 ${10 + k * 10}h70"/>`).join('')}</g>
    <g fill="#141418">${[[20, 60], [30, 50], [40, 40], [50, 30], [60, 20], [50, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.3"/>`).join('')}</g>
    <g fill="#f3f3ee" stroke="#9a9a90" stroke-width="0.6">${[[30, 40], [40, 50], [60, 40], [40, 30], [70, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.3"/>`).join('')}</g>
    <path d="M20 60L60 20" stroke="#dc2626" stroke-width="2" stroke-linecap="round" opacity="0.85"/></svg>`,
  battleship: `<svg viewBox="0 0 90 90"><rect x="2" y="2" width="86" height="86" rx="6" fill="var(--sea)" stroke="var(--sea-line)"/>
    <path d="M19 2v86M36 2v86M53 2v86M70 2v86M2 19h86M2 36h86M2 53h86M2 70h86" stroke="var(--sea-line)" stroke-width="0.8"/>
    <path d="M23 25h40q8 0 8 4.5t-8 4.5h-40q-3 0-3-4.5t3-4.5z" fill="var(--ship)" stroke="var(--ship-edge)" stroke-width="1.2"/>
    <g fill="var(--ship-deck)"><circle cx="44.5" cy="29.5" r="2.3"/><circle cx="61.5" cy="29.5" r="2.3"/></g>
    <circle cx="27.5" cy="29.5" r="6" fill="var(--hit)"/><path d="M24.5 26.5l6 6M24.5 32.5l6-6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <rect x="56" y="57" width="11" height="28" rx="5" fill="var(--sunk)" stroke="var(--sunk-edge)"/>
    <path d="M58.5 61l6 6M58.5 67l6-6M58.5 74l6 6M58.5 80l6-6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    <g fill="var(--miss)"><circle cx="10.5" cy="61.5" r="2.4"/><circle cx="27.5" cy="78.5" r="2.4"/><circle cx="44.5" cy="44.5" r="2.4"/><circle cx="78.5" cy="10.5" r="2.4"/></g></svg>`,
  klondike: felt(`${miniCard(8, 8, 'A', 'S')}${miniCard(34, 8, '', '')}${miniCard(60, 8, 'A', 'H')}
    ${miniCard(8, 48, '', '')}${miniCard(8, 52, 'K', 'S')}${miniCard(34, 46, 'Q', 'H')}${miniCard(60, 44, '', '')}${miniCard(60, 49, 'J', 'C')}`),
  freecell: felt(`<g fill="none" stroke="rgba(255,255,255,.45)" stroke-dasharray="3 2"><rect x="8" y="8" width="17" height="24" rx="2"/><rect x="28" y="8" width="17" height="24" rx="2"/></g>
    ${miniCard(48, 6, '7', 'D', 8)}${miniCard(14, 40, '9', 'C')}${miniCard(14, 50, '8', 'H')}${miniCard(50, 40, '5', 'S')}${miniCard(50, 50, '4', 'D')}`),
  spider: felt(`${miniCard(6, 8, '', '')}${miniCard(6, 14, '9', 'S')}${miniCard(6, 26, '8', 'S')}${miniCard(32, 8, 'K', 'S')}${miniCard(32, 20, 'Q', 'S')}${miniCard(32, 32, 'J', 'S')}
    ${miniCard(58, 8, '', '')}${miniCard(58, 13, '', '')}${miniCard(58, 18, '6', 'H')}${miniCard(58, 30, '5', 'H')}`),
  blackjack: felt(`<path d="M10 52h70" stroke="rgba(255,255,255,.4)" stroke-dasharray="3 3"/>${miniCard(26, 10, '10', 'C', -6)}${miniCard(44, 10, '', '', 6)}
    ${miniCard(24, 56, 'A', 'H', -8)}${miniCard(42, 54, 'K', 'S', 6)}
    <circle cx="76" cy="72" r="8" fill="#dc2626" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/><circle cx="76" cy="68" r="8" fill="#2563eb" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/>`),
};

const SAVE_INFO = {
  sudoku: () => {
    const g = load('sudoku:game', { peek: true });
    if (!g || g.status !== 'playing') return null;
    const filled = g.values.filter((v, i) => v && !g.puzzle[i]).length;
    return filled ? `Đang chơi dở · đã điền ${filled} ô` : null;
  },
  kakuro: () => {
    const d = load('kakuro:progress', { peek: true });
    return d?.solved?.length ? `Đã giải ${d.solved.length} đề` : null;
  },
  minesweeper: () => (load('minesweeper:game', { peek: true })?.status === 'playing' ? 'Đang chơi dở' : null),
  chess: () => {
    const g = load('chess:game', { version: 2, peek: true });
    if (!g?.moves?.length || g.manualResult) return null;
    return `${g.opponent?.mode === 'ai' ? 'Ván với máy' : 'Ván đang lưu'} · ${g.moves.length} nửa nước`;
  },
  checkers: () => {
    const g = load('checkers:game', { version: 2, peek: true });
    if (!g?.state?.moves?.length || g.state.result) return null;
    return `${g.opponent?.mode === 'ai' ? 'Ván với máy' : 'Ván đang lưu'} · ${g.state.moves.length} nước`;
  },
  gomoku: () => {
    const g = load('gomoku:game', { version: 2, peek: true });
    if (!g?.moves?.length) return null;
    return `${g.opponent?.mode === 'ai' ? 'Ván với máy' : 'Ván đang lưu'} · ${g.moves.length} quân trên bàn`;
  },
  battleship: () => {
    const g = load('battleship:game', { peek: true });
    if (!g || !Array.isArray(g.history)) return null;
    if (g.phase === 'setup') return g.fleets?.player?.length ? `Đang bố trí hạm đội · ${g.fleets.player.length}/5 tàu` : null;
    if (g.phase !== 'player' && g.phase !== 'bot') return null;
    return `Đang chơi dở · bạn đã bắn ${g.history.filter((h) => h.by === 'player').length} phát`;
  },
  klondike: () => solitaireInfo('klondike'),
  freecell: () => solitaireInfo('freecell'),
  spider: () => solitaireInfo('spider'),
  blackjack: () => {
    const g = load('blackjack:session', { peek: true });
    if (!g || typeof g.balance !== 'number') return null;
    return `Điểm ảo: ${g.balance.toLocaleString('vi-VN')}${g.phase === 'player' ? ' · đang giữa ván' : ''}`;
  },
};

function solitaireInfo(id) {
  const g = load(`${id}:game`, { peek: true });
  if (!g?.state?.moves) return null;
  return `Đang chơi dở · Ván #${g.seed} · ${g.state.moves} nước`;
}

function gameCard(game) {
  let info = null;
  try { info = SAVE_INFO[game.id]?.(); } catch { info = null; }
  return el('article', { class: 'game-card' },
    el('a', { class: `thumb ${game.group === 'cards' ? 'felt' : ''}`, href: game.href, tabindex: '-1', 'aria-hidden': 'true', html: THUMBS[game.id] }),
    el('div', { class: 'body' },
      el('span', { class: 'tag' }, game.tag),
      el('h2', {}, game.name),
      el('p', {}, game.desc),
      el('span', { class: `meta ${info ? 'has-save' : ''}` }, info || ''),
      el('a', { class: 'btn btn-primary', href: game.href }, info ? 'Chơi tiếp' : 'Chơi')));
}

document.getElementById('game-groups').replaceChildren(...GROUPS.map((group) => el('section', { 'aria-labelledby': `group-${group.id}` },
  el('h2', { class: 'group-title', id: `group-${group.id}` }, group.name, el('small', {}, group.desc)),
  el('div', { class: 'game-grid' }, GAMES.filter((g) => g.group === group.id).map(gameCard)))));
