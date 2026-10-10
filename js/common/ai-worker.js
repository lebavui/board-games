// Web Worker chạy đối thủ máy để giao diện không bị đứng khi máy tính toán.
// Tin nhắn vào: { id, game, args }; tin nhắn ra: { id, move } hoặc { id, error }.
const LOADERS = {
  chess: () => import('../games/chess/ai.js'),
  checkers: () => import('../games/checkers/ai.js'),
  gomoku: () => import('../games/gomoku/ai.js'),
};

self.addEventListener('message', async (event) => {
  const { id, game, args } = event.data;
  try {
    const mod = await LOADERS[game]();
    self.postMessage({ id, move: mod.chooseMove(...args) });
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
});
