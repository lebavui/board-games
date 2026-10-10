// Kiểm thử Bắn tàu: luật, đặt tàu, bot và điều phối lượt máy. Chạy: node tests/battleship.test.mjs
import assert from 'node:assert/strict';
import {
  SIZE, SHIPS, idx, coordName, shipCells, placementError, withShip, withoutShip, isFleetComplete, isFleetValid,
  randomFleet, createGame, setPlayerFleet, canStart, startBattle, fire, observe, shipsAfloat, validateGame, fleetDamage,
} from '../js/games/battleship/logic.js';
import { chooseShot } from '../js/games/battleship/bot.js';
import { createMatch, botTurn } from '../js/games/battleship/match.js';
import { createRng } from '../js/cards/deck.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; };
const cell = (name) => idx(Number(name.slice(1)) - 1, 'ABCDEFGHIJ'.indexOf(name[0]));

// Hạm đội các tàu nằm sát nhau ở góc trên trái (chạm cạnh và góc).
const PACKED = [
  { id: 'carrier', r: 0, c: 0, dir: 'h' },
  { id: 'battleship', r: 1, c: 0, dir: 'h' },
  { id: 'cruiser', r: 2, c: 0, dir: 'h' },
  { id: 'submarine', r: 2, c: 5, dir: 'h' },
  { id: 'destroyer', r: 1, c: 4, dir: 'v' },
];

function battle(playerFleet = PACKED, { level = 'medium', seed = 7 } = {}) {
  return startBattle(setPlayerFleet(createGame({ level, seed }), playerFleet));
}

test('tọa độ và kích thước tàu', () => {
  assert.equal(coordName(idx(4, 3)), 'D5');
  assert.equal(coordName(idx(9, 9)), 'J10');
  for (const s of SHIPS) {
    assert.equal(shipCells({ id: s.id, r: 0, c: 0, dir: 'h' }).length, s.size);
    assert.equal(shipCells({ id: s.id, r: 0, c: 0, dir: 'v' }).length, s.size);
  }
  assert.deepEqual(shipCells({ id: 'destroyer', r: 3, c: 4, dir: 'v' }), [idx(3, 4), idx(4, 4)]);
  assert.deepEqual(SHIPS.map((s) => s.size), [5, 4, 3, 3, 2]);
});

test('không vượt bàn, không chồng nhau, cho phép chạm nhau', () => {
  assert.equal(placementError([], { id: 'carrier', r: 0, c: 6, dir: 'h' }), 'out');
  assert.equal(placementError([], { id: 'carrier', r: 6, c: 0, dir: 'v' }), 'out');
  assert.equal(placementError([], { id: 'carrier', r: 0, c: 5, dir: 'h' }), null);
  assert.equal(placementError([], { id: 'destroyer', r: -1, c: 0, dir: 'v' }), 'out');
  assert.equal(placementError([], { id: 'ufo', r: 0, c: 0, dir: 'h' }), 'unknown');
  const fleet = withShip([], { id: 'carrier', r: 4, c: 2, dir: 'h' });
  assert.equal(placementError(fleet, { id: 'destroyer', r: 3, c: 4, dir: 'v' }), 'overlap');
  assert.equal(withShip(fleet, { id: 'destroyer', r: 3, c: 4, dir: 'v' }), null);
  // Chạm cạnh (hàng ngay trên) và chạm góc đều hợp lệ.
  assert.equal(placementError(fleet, { id: 'destroyer', r: 3, c: 2, dir: 'h' }), null);
  assert.equal(placementError(fleet, { id: 'destroyer', r: 5, c: 7, dir: 'h' }), null);
  assert.equal(placementError(fleet, { id: 'destroyer', r: 2, c: 1, dir: 'v' }), null);
  assert.ok(isFleetComplete(PACKED), 'hạm đội sát nhau vẫn hợp lệ');
  // Dời chính tàu đó sang chỗ chồng lên vị trí cũ của nó là hợp lệ.
  const moved = withShip(fleet, { id: 'carrier', r: 4, c: 3, dir: 'h' });
  assert.equal(moved.length, 1);
  assert.equal(moved[0].c, 3);
  assert.equal(withoutShip(moved, 'carrier').length, 0);
  // Hạm đội trùng loại hoặc chồng nhau bị từ chối.
  assert.equal(isFleetValid([PACKED[0], PACKED[0]]), false);
  assert.equal(isFleetValid([PACKED[0], { id: 'destroyer', r: 0, c: 4, dir: 'v' }]), false);
  assert.equal(isFleetComplete(PACKED.slice(0, 4)), false);
});

test('đặt ngẫu nhiên luôn đủ năm tàu hợp lệ và tái lập được theo seed', () => {
  for (let seed = 1; seed <= 1500; seed++) {
    const fleet = randomFleet(createRng(seed));
    assert.ok(isFleetComplete(fleet), `seed ${seed}`);
  }
  assert.deepEqual(randomFleet(createRng(42)), randomFleet(createRng(42)));
  // Giữ nguyên tàu đã đặt, chỉ đặt ngẫu nhiên phần còn lại.
  const fixed = [{ id: 'carrier', r: 9, c: 5, dir: 'h' }, { id: 'destroyer', r: 0, c: 0, dir: 'v' }];
  const filled = randomFleet(createRng(3), fixed);
  assert.ok(isFleetComplete(filled));
  assert.deepEqual(filled.find((p) => p.id === 'carrier'), fixed[0]);
  // Bàn gần kín: chỉ còn đúng một chỗ cho tàu khu trục => quay lui tìm ra, không lặp vô hạn.
  const tight = [
    { id: 'carrier', r: 0, c: 0, dir: 'h' }, { id: 'battleship', r: 0, c: 5, dir: 'h' },
  ];
  assert.ok(isFleetComplete(randomFleet(createRng(9), tight)));
});

test('bắn trúng, trượt, bắn lặp, sai lượt; lượt luôn chuyển kể cả khi trúng', () => {
  let s = battle();
  assert.equal(s.phase, 'player');
  assert.equal(fire(s, 'bot', 0).error, 'turn');
  const botShip = s.fleets.bot[0];
  const target = shipCells(botShip)[0];
  let res = fire(s, 'player', target);
  assert.ok(res.ok && res.event.hit && !res.event.sunk);
  s = res.state;
  assert.equal(s.phase, 'bot', 'trúng vẫn chuyển lượt');
  assert.equal(fire(s, 'player', 5).error, 'turn');
  res = fire(s, 'bot', cell('J10'));
  assert.ok(res.ok && !res.event.hit);
  s = res.state;
  assert.equal(s.phase, 'player');
  assert.equal(fire(s, 'player', target).error, 'repeat');
  assert.equal(fire(s, 'player', 100).error, 'out');
  assert.equal(fire(s, 'player', -1).error, 'out');
  // Cùng ô J10 nhưng trên bàn kia vẫn bắn được.
  assert.ok(fire(s, 'player', cell('J10')).ok);
});

test('đánh chìm tàu, thắng và khóa bàn', () => {
  let s = battle();
  const order = s.fleets.bot.flatMap((p) => shipCells(p));
  const misses = [];
  for (let i = 0; i < 100 && misses.length < order.length; i++) if (!PACKED.some((p) => shipCells(p).includes(i))) misses.push(i);
  const sunk = [];
  order.forEach((c, k) => {
    const res = fire(s, 'player', c);
    assert.ok(res.ok);
    if (res.event.sunk) sunk.push(res.event.sunk);
    s = res.state;
    if (k < order.length - 1) {
      assert.equal(res.event.over, false);
      s = fire(s, 'bot', misses[k]).state;
    } else {
      assert.equal(res.event.over, true);
    }
  });
  assert.deepEqual(sunk, SHIPS.map((x) => x.id), 'mỗi tàu chìm đúng một lần, công bố loại tàu');
  assert.equal(s.phase, 'won');
  assert.equal(shipsAfloat(s, 'bot'), 0);
  assert.equal(shipsAfloat(s, 'player'), 5);
  assert.equal(fire(s, 'player', misses[0]).error, 'over');
  assert.equal(fire(s, 'bot', misses[0]).error, 'over');
});

test('thua khi máy đánh chìm toàn bộ hạm đội', () => {
  let s = battle();
  const botCells = new Set(s.fleets.bot.flatMap((p) => shipCells(p)));
  const playerMisses = [...Array(100).keys()].filter((i) => !botCells.has(i));
  const mine = PACKED.flatMap((p) => shipCells(p));
  mine.forEach((c, k) => {
    s = fire(s, 'player', playerMisses[k]).state;
    s = fire(s, 'bot', c).state;
  });
  assert.equal(s.phase, 'lost');
  assert.ok(fleetDamage(s, 'player').every((d) => d.sunk));
  assert.equal(fire(s, 'player', playerMisses[50]).error, 'over');
});

test('quan sát công khai không lộ tàu chưa chìm', () => {
  let s = battle();
  const destroyer = shipCells(PACKED[4]);
  s = fire(s, 'player', 99).state;
  s = fire(s, 'bot', destroyer[0]).state;
  s = fire(s, 'player', 98).state;
  const obs = observe(s, 'player');
  assert.deepEqual(Object.keys(obs).sort(), ['grid', 'remaining', 'shots', 'size', 'sunk']);
  assert.equal(obs.grid[destroyer[0]], 'hit');
  assert.equal(obs.grid[destroyer[1]], 'unknown', 'ô tàu chưa bị bắn vẫn là chưa biết');
  assert.equal(obs.grid.filter((g) => g !== 'unknown').length, 1);
  assert.equal(JSON.stringify(obs).includes('"r"'), false);
  s = fire(s, 'bot', destroyer[1]).state;
  const after = observe(s, 'player');
  assert.deepEqual(after.sunk, [{ id: 'destroyer', size: 2, cells: destroyer }]);
  assert.deepEqual(after.remaining.map((x) => x.size), [5, 4, 3, 3]);
  assert.ok(destroyer.every((c) => after.grid[c] === 'sunk'));
});

/* ---------- Bot ---------- */

/** Chơi một trận trong đó cả hai bên đều do thuật toán chọn ô; trả về số phát của máy và chế độ từng phát. */
function simulate(level, seed, playerFleet) {
  let s = battle(playerFleet || randomFleet(createRng(seed * 31 + 1)), { level, seed });
  let rngP = seed + 99;
  const botModes = [];
  for (let turn = 0; turn < 400 && (s.phase === 'player' || s.phase === 'bot'); turn++) {
    if (s.phase === 'player') {
      const c = chooseShot(observe(s, 'bot'), 'easy', rngP);
      rngP = c.rng;
      const res = fire(s, 'player', c.cell);
      assert.ok(res.ok, `người chơi giả bắn ô hợp lệ (${res.error})`);
      s = res.state;
    } else {
      const obs = observe(s, 'player');
      const pendingHits = obs.grid.includes('hit');
      const choice = chooseShot(obs, level, s.botRng);
      assert.equal(obs.grid[choice.cell], 'unknown', 'máy không bắn lại ô đã bắn');
      if (level === 'medium' && pendingHits) assert.equal(choice.mode, 'target', 'còn ô trúng chưa chìm thì máy luôn truy tiếp');
      botModes.push(choice.mode);
      const res = botTurn(s);
      assert.ok(res.ok);
      assert.equal(res.event.cell, choice.cell);
      s = res.state;
    }
  }
  assert.ok(s.phase === 'won' || s.phase === 'lost');
  return { state: s, botShots: s.history.filter((h) => h.by === 'bot').length, botModes };
}

/** Số phát máy cần để đánh chìm cả hạm đội (bỏ qua lượt người chơi: chỉ đo riêng thuật toán của máy). */
function shotsToWin(level, seed, fleet) {
  let s = battle(fleet, { level, seed });
  let k = 0;
  while (s.phase !== 'lost') {
    const res = botTurn({ ...s, phase: 'bot' });
    assert.ok(res.ok);
    s = res.state;
    k++;
  }
  return k;
}

test('máy không bắn lặp và luôn kết thúc ván (cả hai mức)', () => {
  for (const level of ['easy', 'medium']) {
    for (let seed = 1; seed <= 60; seed++) simulate(level, seed);
  }
});

test('máy chỉ dựa vào quan sát công khai', () => {
  // Hai hạm đội khác nhau nhưng cùng một quan sát (mọi phát đều trượt) => máy chọn cùng ô.
  const a = battle(PACKED, { seed: 5 });
  const b = battle(randomFleet(createRng(77), []), { seed: 5 });
  let sa = fire(a, 'player', 0).state;
  let sb = fire(b, 'player', 0).state;
  for (const id of ['carrier', 'battleship']) assert.ok(sb.fleets.player.some((p) => p.id === id));
  // Đảm bảo cùng quan sát (chưa phát nào của máy).
  assert.deepEqual(observe(sa, 'player'), observe(sb, 'player'));
  assert.equal(botTurn(sa).event.cell, botTurn(sb).event.cell);
  // chooseShot chạy được với quan sát tự dựng, bị đóng băng — không cần (và không thể) đọc hạm đội.
  const grid = new Array(100).fill('unknown');
  grid[cell('D5')] = 'hit';
  grid[cell('E5')] = 'hit';
  const obs = Object.freeze({ size: SIZE, grid: Object.freeze(grid), sunk: Object.freeze([]), remaining: Object.freeze(SHIPS.map((x) => Object.freeze({ id: x.id, size: x.size }))), shots: 2 });
  for (let r = 1; r < 50; r++) {
    const pick = chooseShot(obs, 'medium', r);
    assert.ok([cell('C5'), cell('F5')].includes(pick.cell), 'nối dài theo trục của hai ô trúng thẳng hàng');
    assert.equal(pick.mode, 'target');
  }
});

test('mức Trung bình: dò theo mẫu bàn cờ, truy ô liền kề, quay lại dò khi hết mục tiêu', () => {
  const empty = { size: SIZE, grid: new Array(100).fill('unknown'), sunk: [], remaining: SHIPS.map((x) => ({ id: x.id, size: x.size })), shots: 0 };
  for (let r = 1; r < 200; r++) {
    const pick = chooseShot(empty, 'medium', r);
    assert.equal(pick.mode, 'hunt');
    assert.equal((Math.floor(pick.cell / SIZE) + (pick.cell % SIZE)) % 2, 0, 'ô dò thuộc mẫu bàn cờ');
  }
  // Một ô trúng đơn lẻ: bắn một trong bốn ô liền kề.
  const one = { ...empty, grid: empty.grid.slice() };
  one.grid[cell('E5')] = 'hit';
  one.grid[cell('E4')] = 'miss';
  const near = [cell('D5'), cell('F5'), cell('E6')];
  for (let r = 1; r < 50; r++) assert.ok(near.includes(chooseShot(one, 'medium', r).cell));
  // Ô trúng ở góc, các ô quanh đã bắn trượt => không còn mục tiêu, quay lại dò tìm.
  const stuck = { ...empty, grid: empty.grid.slice() };
  stuck.grid[cell('A1')] = 'hit';
  stuck.grid[cell('B1')] = 'miss';
  stuck.grid[cell('A2')] = 'miss';
  const back = chooseShot(stuck, 'medium', 3);
  assert.equal(back.mode, 'hunt');
  assert.equal(stuck.grid[back.cell], 'unknown');
  // Dãy trúng bị chặn hai đầu (hai tàu nằm cạnh nhau) => thử hướng vuông góc.
  const blocked = { ...empty, grid: empty.grid.slice() };
  for (const n of ['B3', 'C3']) blocked.grid[cell(n)] = 'hit';
  for (const n of ['A3', 'D3']) blocked.grid[cell(n)] = 'miss';
  const perp = [cell('B2'), cell('B4'), cell('C2'), cell('C4')];
  for (let r = 1; r < 30; r++) assert.ok(perp.includes(chooseShot(blocked, 'medium', r).cell));
  // Không coi ô cạnh tàu đã chìm là trống: ô trúng còn lại sát tàu chìm vẫn được truy tiếp.
  const nextTo = { ...empty, grid: empty.grid.slice(), remaining: empty.remaining.filter((x) => x.id !== 'destroyer') };
  nextTo.grid[cell('A1')] = 'sunk';
  nextTo.grid[cell('B1')] = 'sunk';
  nextTo.grid[cell('A2')] = 'hit';
  const follow = chooseShot(nextTo, 'medium', 11);
  assert.equal(follow.mode, 'target');
  assert.ok([cell('A3'), cell('B2')].includes(follow.cell));
  // Mức Dễ: ngẫu nhiên trong các ô chưa bắn.
  for (let r = 1; r < 100; r++) assert.equal(one.grid[chooseShot(one, 'easy', r).cell], 'unknown');
});

test('máy xử lý được các tàu nằm sát nhau', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { botShots } = simulate('medium', seed, PACKED);
    assert.ok(botShots <= 100);
  }
  // Mức Trung bình phải tốt hơn hẳn mức Dễ khi tự đánh chìm cả hạm đội.
  let easy = 0, medium = 0, packed = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const fleet = randomFleet(createRng(seed * 13));
    easy += shotsToWin('easy', seed, fleet);
    medium += shotsToWin('medium', seed, fleet);
    packed += shotsToWin('medium', seed, PACKED);
  }
  assert.ok(medium / N < 70, `trung bình ${medium / N} phát`);
  assert.ok(medium < easy * 0.8, `trung bình ${medium / N} so với dễ ${easy / N}`);
  assert.ok(packed / N < 75, `hạm đội sát nhau: ${packed / N} phát`);
  console.log(`  số phát trung bình để thắng — Dễ: ${(easy / N).toFixed(1)}, Trung bình: ${(medium / N).toFixed(1)}, Trung bình với tàu sát nhau: ${(packed / N).toFixed(1)}`);
});

/* ---------- Lưu / tải và điều phối ---------- */

test('lưu/tải: bản lưu được kiểm tra bằng cách chơi lại lịch sử', () => {
  const { state } = simulate('medium', 3);
  const copy = validateGame(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(copy, state);
  const setup = setPlayerFleet(createGame({ seed: 4 }), PACKED.slice(0, 3));
  assert.deepEqual(validateGame(JSON.parse(JSON.stringify(setup))), setup);
  const tampered = JSON.parse(JSON.stringify(state));
  tampered.history[0].hit = !tampered.history[0].hit;
  assert.equal(validateGame(tampered), null);
  assert.equal(validateGame({ ...state, phase: 'player' }), null);
  assert.equal(validateGame({ ...state, fleets: { ...state.fleets, bot: state.fleets.bot.slice(1) } }), null);
  assert.equal(validateGame(null), null);
  assert.equal(validateGame({ ...state, level: 'hard' }), null);
});

test('chỉ bắt đầu khi đủ năm tàu hợp lệ', () => {
  let s = createGame({ seed: 2 });
  assert.equal(canStart(s), false);
  assert.equal(startBattle(s), null);
  s = setPlayerFleet(s, PACKED.slice(0, 4));
  assert.equal(canStart(s), false);
  s = setPlayerFleet(s, PACKED);
  assert.equal(canStart(s), true);
  assert.equal(setPlayerFleet(startBattle(s), []), null, 'không đổi hạm đội sau khi trận bắt đầu');
  assert.ok(isFleetComplete(s.fleets.bot));
});

/** Bộ hẹn giờ giả: chạy tác vụ bằng tay. `leaky`: clear() không gỡ được tác vụ (mô phỏng callback đã vào hàng đợi). */
function fakeTimer({ leaky = false } = {}) {
  const tasks = new Map();
  let n = 0;
  return {
    tasks,
    set(fn) { tasks.set(++n, fn); return n; },
    clear(h) { if (!leaky) tasks.delete(h); },
    runAll() { const list = [...tasks.values()]; tasks.clear(); list.forEach((fn) => fn()); return list.length; },
  };
}

test('điều phối: đúng một lượt máy sau mỗi phát của người chơi', () => {
  const timer = fakeTimer();
  const saves = [];
  const m = createMatch(battle(), { timer, persist: (s) => saves.push(JSON.stringify(s)) });
  assert.ok(m.playerFire(0));
  assert.equal(m.playerFire(1), null, 'khóa bắn trong lượt máy');
  assert.equal(m.state.phase, 'bot');
  m.resume();
  m.resume();
  assert.equal(timer.tasks.size, 1, 'không lên lịch hai lần');
  timer.runAll();
  assert.equal(m.state.phase, 'player');
  assert.equal(m.state.history.filter((h) => h.by === 'bot').length, 1);
  assert.equal(timer.runAll(), 0);
  assert.equal(m.state.history.length, 2);
  assert.equal(JSON.parse(saves.at(-1)).history.length, 2, 'đã lưu sau phát của máy');
});

test('tải lại giữa lượt máy: tiếp tục đúng một phát, không bắn kép', () => {
  const timer1 = fakeTimer();
  let saved = null;
  const m1 = createMatch(battle(), { timer: timer1, persist: (s) => { saved = JSON.stringify(s); } });
  m1.playerFire(cell('E5'));
  assert.equal(JSON.parse(saved).phase, 'bot');
  // "Tải lại trang": trang cũ biến mất trước khi máy bắn; trang mới đọc bản lưu.
  m1.dispose();
  assert.equal(timer1.runAll(), 0);
  const timer2 = fakeTimer();
  const restored = validateGame(JSON.parse(saved));
  assert.ok(restored);
  const m2 = createMatch(restored, { timer: timer2, persist: (s) => { saved = JSON.stringify(s); } });
  m2.resume();
  timer2.runAll();
  timer2.runAll();
  const botShots = m2.state.history.filter((h) => h.by === 'bot');
  assert.equal(botShots.length, 1);
  assert.equal(m2.state.phase, 'player');
  // Kết quả giống hệt khi không tải lại (RNG của máy được lưu cùng ván).
  const timer3 = fakeTimer();
  const m3 = createMatch(battle(), { timer: timer3 });
  m3.playerFire(cell('E5'));
  timer3.runAll();
  assert.deepEqual(m3.state.history, m2.state.history);
  // Tải lại SAU khi máy đã bắn: không có lượt máy nào chạy thêm.
  const m4 = createMatch(validateGame(JSON.parse(saved)), { timer: timer3 });
  m4.resume();
  assert.equal(timer3.runAll(), 0);
});

test('ván mới không nhận tác vụ máy của ván cũ', () => {
  for (const leaky of [false, true]) {
    const timer = fakeTimer({ leaky });
    const m = createMatch(battle(), { timer });
    m.playerFire(0);
    assert.equal(m.botPending, true);
    m.replace(createGame({ seed: 99 }));
    assert.equal(m.botPending, false);
    timer.runAll(); // với leaky: callback cũ vẫn chạy nhưng bị bỏ qua nhờ token
    assert.equal(m.state.phase, 'setup');
    assert.equal(m.state.history.length, 0);
    // Ván mới vẫn chơi bình thường.
    m.update(startBattle(setPlayerFleet(m.state, PACKED)));
    m.playerFire(5);
    assert.equal(timer.runAll(), 1);
    assert.equal(m.state.history.length, 2);
  }
});

test('kết thúc ván: không lên lịch máy, không nhận phát bắn', () => {
  const timer = fakeTimer();
  let s = battle();
  const cells = s.fleets.bot.flatMap((p) => shipCells(p));
  const m = createMatch(s, { timer });
  for (const c of cells) {
    m.playerFire(c);
    timer.runAll();
  }
  assert.equal(m.state.phase, 'won');
  assert.equal(m.botPending, false);
  assert.equal(m.playerFire(cells[0] === 0 ? 1 : 0), null);
});

console.log(`✓ battleship: ${passed} nhóm kiểm thử`);
