# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong kho mã này.

## Tổng quan

**Trí Tuệ Bàn Cờ** — website trò chơi trí tuệ chạy hoàn toàn trên trình duyệt: Sudoku, Kakuro, Dò mìn,
Cờ vua, Cờ đam, Cờ caro, Bắn tàu và nhóm game bài (Klondike, FreeCell, Spider, Blackjack).
HTML/CSS/JavaScript thuần (ES modules) + p5.js 1.9.4 (instance mode). **Không có backend, không có bước build,
không có `package.json`** — đừng thêm bundler, framework hay dependency npm.

README.md mô tả chi tiết luật đã chọn cho từng trò chơi; đọc mục liên quan trước khi sửa luật.

## Lệnh

```bash
python -m http.server 8000        # chạy thử: mở http://localhost:8000/ (ES modules không chạy qua file://)
node tests/run-all.mjs            # toàn bộ kiểm thử logic (Node, không cần trình duyệt)
node tests/sudoku.test.mjs        # chạy một tệp kiểm thử
node tools/generate-kakuro.mjs <rows> <cols> <density> [seed] [số đề] [dãy dài tối đa]   # sinh đề Kakuro ứng viên
```

Kiểm thử dùng `node:assert/strict` thuần, không có framework. Thêm tệp kiểm thử mới thì phải thêm tên vào mảng
`files` trong `tests/run-all.mjs`.

## Kiến trúc

- `index.html`, `<game>.html` — mỗi trò một trang; trang nạp `js/vendor/p5.min.js` (script thường, `defer`) rồi
  `js/games/<game>/main.js` (module).
- `js/games/<game>/` tách ba lớp:
  - `logic.js` — luật thuần: không DOM, không p5, không `window`. Phải import được từ Node để kiểm thử.
  - `view.js` — chỉ vẽ bằng p5 từ trạng thái, không thay đổi trạng thái.
  - `main.js` — điều khiển trang: nhập liệu, trạng thái, lưu trữ, hộp thoại.
  - Có thể có thêm `ai.js` (đối thủ máy), `bot.js`/`match.js` (Bắn tàu), `puzzles.js` (Kakuro), `pieces.js` (Cờ vua).
- `js/common/`
  - `ui.js` — thanh điều hướng, chủ đề, `confirmDialog`/`resultDialog`/`toast`, `bindActions`, helper `el()`.
  - `storage.js` — `load`/`save`/`loadSettings`/`saveSettings` có phiên bản (xem bên dưới).
  - `p5board.js` — `createBoard(container, { layout, draw, onPress, ... })`: co giãn canvas, Pointer Events,
    nhấn giữ, `noLoop` + `redraw`. Dùng `CANVAS_FONT` cho chữ trên canvas.
  - `ai-client.js` + `ai-worker.js` — chạy `chooseMove(...args)` của `js/games/<game>/ai.js` trong Web Worker,
    có hủy lượt và dự phòng chạy trên luồng chính. Thêm trò có AI thì đăng ký ở **cả hai** bảng `LOADERS`/`FALLBACK`.
  - `opponent.js` — bộ chọn Hai người / Chơi với máy, bên quân, độ khó.
  - `games.js` — danh mục trò chơi (`GROUPS`, `GAMES`) cho thanh điều hướng và trang chủ; thêm trò mới thì khai báo ở đây.
- `js/cards/` — hạ tầng dùng chung cho game bài: `deck.js` (lá bài bất biến `{ id, suit, rank, deck }`, ID dạng
  `S12.0`, RNG Mulberry32 + Fisher–Yates theo seed), `session.js` (hoàn tác, chơi lại cùng seed, lưu/tải có kiểm tra
  toàn vẹn), `card-render.js`, `card-table.js`, `layout.js`, `solitaire-page.js`. Trạng thái úp/ngửa là bản đồ
  `id → true` riêng; logic game bài là hàm thuần nhận trạng thái và trả trạng thái mới.
- `js/vendor/` — p5.min.js 1.9.4 và chess.js 1.0.0 (ESM) đặt sẵn để chạy offline; không sửa, không đổi sang CDN.

## Quy ước quan trọng

- **Lưu trữ:** khóa có tiền tố `tritue-banco:`, bản ghi `{ v, savedAt, data }`. Khi đổi cấu trúc dữ liệu lưu,
  tăng hằng `SAVE_VERSION` trong `main.js` và viết `migrate` (hoặc trả `null` để bỏ bản cũ). Không bao giờ xóa/ghi đè
  bản lưu có phiên bản mới hơn mã hiện tại. Cài đặt được gộp với giá trị mặc định; dữ liệu đọc về phải được kiểm tra
  (bản lưu hỏng/không khớp thì bỏ qua, không làm sập trang).
- Lưu ván sau mỗi nước; đổi kích thước cửa sổ chỉ vẽ lại, không khởi động lại ván.
- **Tính tất định:** hàm luật/AI có dùng ngẫu nhiên nhận tham số `rng` (mặc định `Math.random` chỉ là dự phòng);
  kiểm thử và các ván có seed truyền RNG có seed vào, để tái hiện ván và kiểm thử được.
- Hàm chọn nước của máy chỉ nhận thông tin công khai (ví dụ Bắn tàu: `observe()` → `chooseShot()`).
- Hỗ trợ cả chuột và cảm ứng, màn hình hẹp, chủ đề sáng/tối (biến CSS trong `css/style.css`). Thông tin không được
  phân biệt chỉ bằng màu.
- Blackjack chỉ dùng điểm ảo — không thêm bất cứ thứ gì liên quan tiền thật.
- Ngôn ngữ: giao diện, comment và thông báo kiểm thử đều bằng **tiếng Việt**; giữ nguyên phong cách đó.
- Khi thay đổi luật hoặc hành vi người dùng thấy được, cập nhật mục tương ứng trong README.md.
