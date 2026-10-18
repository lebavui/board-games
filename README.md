# Trí Tuệ Bàn Cờ

Website trò chơi trí tuệ trên bàn: **Sudoku, Kakuro, Dò mìn, Xếp gạch, Cờ vua, Cờ tướng, Cờ đam, Cờ caro, Bắn tàu**, cùng nhóm
**Game bài**: **Solitaire Klondike, FreeCell, Spider Solitaire, Blackjack**.
HTML/CSS/JavaScript thuần (ES modules) + **p5.js 1.9.4** (instance mode) để vẽ bàn chơi.
Không cần backend hay bước build.

## Chạy

Mở bằng một static web server bất kỳ tại thư mục gốc (ES modules không chạy qua `file://`):

```bash
python -m http.server 8000
# hoặc: npx serve .
```

Rồi mở <http://localhost:8000/>. Mỗi trò chơi có URL riêng: `sudoku.html`, `kakuro.html`,
`minesweeper.html`, `tetris.html`, `chess.html`, `xiangqi.html`, `checkers.html`, `gomoku.html`, `battleship.html`, `klondike.html`, `freecell.html`,
`spider.html`, `blackjack.html`. Trên thanh điều hướng, các game bài nằm trong menu **Game bài**;
trang chủ chia thành hai nhóm “Trò chơi trên bàn” và “Game bài”.

p5.js và chess.js được đặt sẵn trong `js/vendor/` nên chạy được khi không có mạng
(chỉ font Be Vietnam Pro tải từ Google Fonts; thiếu mạng thì dùng font hệ thống).

## Cấu trúc

```
index.html, <game>.html        Trang chủ và trang từng trò chơi
css/style.css                  Phong cách chung, chủ đề sáng/tối (biến CSS)
js/common/
  ui.js                        Thanh điều hướng, chủ đề, hộp thoại, thông báo
  storage.js                   localStorage có phiên bản cấu trúc dữ liệu
  p5board.js                   Khung p5 dùng chung: tự co giãn, chuột + cảm ứng, nhấn giữ
  stopwatch.js, games.js
js/cards/                      Dùng chung cho game bài
  deck.js                      Lá bài { id, suit, rank, deck }, tạo bộ (nhiều bộ), seed RNG, Fisher–Yates, chia/di chuyển
  session.js                   Phiên solitaire: hoàn tác, chơi lại cùng seed, lưu/tải có kiểm tra toàn vẹn
  card-render.js               Vẽ lá bài/mặt lưng/ô trống bằng vector p5 (không dùng ảnh)
  card-table.js                Bàn p5: kéo thả, chạm chọn → chạm đích, hoạt ảnh trượt/lật, gợi ý tô sáng
  layout.js                    Kích thước lá theo màn hình, xòe cột (nén nhưng luôn lộ hạng + chất)
  solitaire-page.js            Điều khiển trang chung cho Klondike / FreeCell / Spider
js/games/<game>/
  logic.js                     Luật chơi thuần (không DOM, không p5) — kiểm thử được bằng Node
  view.js                      Vẽ bàn bằng p5.js
  main.js                      Điều khiển trang: trạng thái, nhập liệu, lưu trữ
js/vendor/                     p5.min.js 1.9.4, chess.js 1.0.0 (ESM)
tests/                         Kiểm thử logic: node tests/run-all.mjs
tools/generate-kakuro.mjs      Công cụ sinh đề Kakuro ứng viên
```

Luật chơi tách khỏi phần vẽ: `view.js` chỉ đọc trạng thái, `logic.js` không biết gì về p5.

## Lưu trữ

Khóa có tiền tố `tritue-banco:`; mỗi bản ghi là `{ v, savedAt, data }`. Khi phiên bản cấu trúc
thay đổi, `load()` gọi hàm `migrate` để nâng cấp bản lưu cũ (ví dụ Cờ vua/Cờ đam/Cờ caro v1 → v2
thêm cấu hình đối thủ máy) hoặc bỏ bản lưu cũ không nâng cấp được. Bản lưu có phiên bản **mới hơn**
mã đang chạy (khi trình duyệt còn giữ mã cũ trong cache) không bao giờ bị xóa hay ghi đè. Cài đặt (độ khó, chủ đề, xoay bàn…)
được gộp với giá trị mặc định nên thêm tùy chọn mới không làm hỏng bản lưu cũ.
Ván chơi được lưu sau mỗi nước; đổi kích thước cửa sổ chỉ vẽ lại, không khởi động lại ván.

## Ghi chú theo trò chơi

- **Sudoku** — đề sinh ngẫu nhiên; sau mỗi lần xóa ô, bộ giải đếm lời giải bảo đảm đề có
  **đúng một lời giải**. Độ khó đo bằng bộ giải mô phỏng kỹ thuật người chơi:
  Dễ = ≥ 36 số, chỉ cần ô/vị trí duy nhất; Trung bình = 30–35 số, cần khóa ứng viên,
  cặp/bộ ba lộ hoặc cặp ẩn; Khó = đề tối giản, cần kỹ thuật vượt các mức trên.
- **Kakuro** — bộ đề có sẵn (`puzzles.js`) từ 5×5 đến bàn lớn 14×14, mỗi đề được kiểm chứng có đúng một lời giải chỉ
  dựa trên các tổng gợi ý (bằng `tests/kakuro.test.mjs` và lại lúc tải trang). Không sinh đề
  ngẫu nhiên lúc chơi. Thắng được xét theo ràng buộc tổng + không lặp số.
- **Dò mìn** — mìn được đặt sau lần mở đầu tiên (ô đó và các ô kề luôn an toàn). Chuột phải
  hoặc nhấn giữ để cắm cờ; trên điện thoại có nút chuyển Mở ô / Cắm cờ. Bàn Khó (30×16)
  được xoay dọc trên màn hình hẹp.
- **Xếp gạch** (kiểu Tetris) — giếng 10×20 (thêm 2 hàng ẩn phía trên để khối xuất hiện). Thứ tự khối theo túi 7
  (Mulberry32 theo seed, trạng thái RNG nằm trong bản lưu nên tải lại vẫn ra đúng dãy khối), hiện 5 khối tiếp theo,
  ô Giữ (mỗi khối giữ một lần), bóng khối (tắt được). Xoay SRS có đá tường; khóa trễ 0,5 giây, gia hạn tối đa 15 lần
  khi di chuyển/xoay. Trọng lực theo công thức chuẩn `(0,8 − (cấp−1)·0,007)^(cấp−1)` giây/hàng; rơi nhanh ×20.
  Điểm × cấp: 100/300/500/800 cho 1–4 hàng, T-spin 400/800/1200/1600 (nhận theo quy tắc 3 góc, không tách T-spin mini),
  B2B ×1,5 cho Tetris/T-spin liên tiếp, combo +50 × combo × cấp, rơi nhanh +1 và thả thẳng +2 mỗi hàng. Lên cấp mỗi 10
  hàng tính từ cấp bắt đầu (1–15, tối đa 20). Thua khi khối mới không có chỗ xuất hiện hoặc khóa hoàn toàn trên đỉnh.
  Thời gian chạy qua `tick(game, dt)` nên luật tất định; ván tự tạm dừng khi rời tab và khi tải lại trang. Lưu sau mỗi
  khối khóa; bảng 5 điểm cao. Trên thiết bị cảm ứng có bàn phím ảo (giữ ◀ ▶ ▼ để lặp), chạm giếng để xoay.
- **Cờ vua** — luật do chess.js xử lý (nhập thành, bắt tốt qua đường, phong cấp, chiếu hết,
  hết nước, lặp ba lần, 50 nước, thiếu quân); p5 vẽ bàn và quân dạng vector.
  Hòa do lặp ba lần và 50 nước được tuyên bố tự động.
- **Cờ tướng** — luật tự viết trong `logic.js` (bàn 90 giao điểm, Đỏ đi trước): cản chân Mã, cản mắt Tượng,
  Tượng không qua sông, Sĩ/Tướng trong cung, Pháo ăn qua đúng một ngòi, Tốt qua sông được đi ngang, cấm hai Tướng đối
  mặt. Chiếu bí **và hết nước đi (vây khốn) đều là thua**. Hòa khi lặp thế cờ ba lần, 60 nước mỗi bên không ăn quân
  (`NO_CAPTURE_LIMIT` = 120 nửa nước), hai bên không còn Xe/Mã/Pháo/Tốt, hoặc thỏa thuận. Đơn giản hóa: không áp dụng
  luật cấm trường chiếu/trường bắt — mọi lặp ba lần là hòa. Ký hiệu kiểu Việt Nam (“P2-5”, “M8.7”, “X1/2”, t/s cho
  quân trước/sau cùng cột, “+” là chiếu). Quân hiển thị chữ Hán (mặc định) hoặc tên tiếng Việt. Bản lưu chỉ chứa danh
  sách nước đi và được kiểm tra bằng cách đi lại từ đầu; nước sai thì bỏ bản lưu.
- **Cờ đam** — American Checkers / English Draughts, luật tự viết trong `logic.js`.
- **Cờ caro** — Gomoku luật tự do 15×15 (≥ 5 quân thắng, không luật cấm Renju).

## Bắn tàu (Battleship)

Trang `battleship.html`, mã trong `js/games/battleship/`:

```
logic.js   Luật thuần: đặt tàu, đặt ngẫu nhiên, bắn, chìm, thắng/thua, quan sát công khai, kiểm tra bản lưu
bot.js     Thuật toán chọn ô của máy — chỉ nhận dữ liệu quan sát công khai
match.js   Điều phối: lên lịch đúng một lượt máy, hủy tác vụ của ván cũ (bộ hẹn giờ truyền vào để kiểm thử)
view.js    Vẽ bàn 10×10 bằng p5 (mỗi bàn một canvas), con trỏ chuột/cảm ứng, hiệu ứng bắn
main.js    Trang: giai đoạn đặt tàu, bắn, nhật ký, lưu ván
```

**Luật đã chọn.** Một người đấu với máy, mỗi bên bàn 10×10 (cột A–J, hàng 1–10) và năm tàu: Tàu sân bay 5,
Thiết giáp hạm 4, Tuần dương hạm 3, Tàu ngầm 3, Tàu khu trục 2. Tàu nằm ngang hoặc dọc, không chồng nhau, không
vượt bàn; **các tàu được phép chạm nhau** (cạnh và góc). Người chơi bắn trước; hai bên luân phiên mỗi lượt **một phát,
kể cả khi bắn trúng**; không bắn lại ô đã bắn. Mỗi phát chỉ báo Trúng/Trượt; khi một tàu chìm, loại tàu được công bố
và **vị trí tàu chìm được hiện cho bên bắn** (áp dụng giống nhau cho người và máy). Đánh chìm cả năm tàu là thắng; khi
ván kết thúc, bàn bị khóa và toàn bộ tàu của máy được hiện ra (tàu chưa chìm có viền đứt). Không có hoàn tác phát bắn.

**Cách chơi.** Chọn tàu trong danh sách rồi chạm ô làm đầu tàu (ngang: kéo sang phải, dọc: kéo xuống). Vị trí dự kiến
màu xanh có ✓ khi hợp lệ, màu đỏ viền đứt có ✕ khi không. Chuột: rê để xem trước, nhấp để đặt. Cảm ứng: chạm lần đầu
hiện vị trí dự kiến, chạm vào nó lần nữa để đặt. Tàu đã đặt có thể chạm để nhấc lên (rồi dời/xoay) hoặc kéo thả.
Nút Xoay / phím **R** đổi hướng, **Esc** hủy chọn; có “Đặt ngẫu nhiên” và “Xóa bố trí”; “Bắt đầu” chỉ bật khi đủ năm tàu
hợp lệ. Ô trên bàn phân biệt bằng hình dạng chứ không chỉ màu: nước trống, chấm (trượt), ✕ trên nền đỏ (trúng),
thân tàu sẫm có gạch chéo + ✕ (tàu đã chìm); có chú thích dưới hai bàn. Trên máy tính hai bàn nằm cạnh nhau; trên màn
hình hẹp hai bàn xếp dọc, khi đang đánh thì vùng biển đối phương được đưa lên trước.

**Đặt ngẫu nhiên** (cho cả máy và nút “Đặt ngẫu nhiên”): với từng tàu, lớn trước, liệt kê mọi vị trí còn hợp lệ, xáo
thứ tự và thử lần lượt, quay lui nếu bế tắc. Tập vị trí là hữu hạn nên thuật toán luôn dừng — không có vòng “thử ngẫu
nhiên đến khi được”. Bố trí của máy sinh từ seed của ván.

**Máy.** API tách bạch: `observe(state, 'player')` tạo dữ liệu quan sát công khai (lưới chưa bắn / trượt / trúng / thuộc
tàu chìm, danh sách tàu đã chìm kèm ô, kích thước các tàu còn lại); `chooseShot(obs, level, rng)` chỉ nhận dữ liệu đó và
trả về một ô; engine `fire()` kiểm tra và trả kết quả. Hàm chọn nước không bao giờ nhận hạm đội của người chơi.
- **Dễ:** chọn ngẫu nhiên trong các ô chưa bắn.
- **Trung bình (hunt/target):** khi không có mục tiêu, dò theo mẫu ô bàn cờ ((hàng + cột) chẵn — mọi tàu dài ≥ 2 đều
  phủ ít nhất một ô như vậy), ưu tiên ô có nhiều cách đặt tàu còn lại. Mọi ô trúng **chưa thuộc tàu đã chìm** là mục tiêu
  (suy ra lại từ quan sát mỗi lượt nên không bao giờ bị quên): ưu tiên nối dài dãy ≥ 2 ô trúng thẳng hàng theo trục của
  dãy, sau đó các ô liền kề bốn hướng (hướng vuông góc với dãy xếp sau — xử lý hai tàu nằm cạnh nhau). Chỉ chọn ô mà ít
  nhất một tàu còn lại có thể nằm qua cả ô trúng lẫn ô đó; **không** coi ô cạnh tàu đã chìm là chắc chắn trống, vì luật
  cho phép tàu chạm nhau. Khi hết ô mục tiêu khả thi, máy quay lại dò tìm.
- Trạng thái RNG của máy được lưu trong ván, nên tải lại trang cho ra đúng phát bắn như khi không tải lại. Trong mô phỏng
  kiểm thử, mức Trung bình cần khoảng 46 phát để đánh chìm cả hạm đội (Dễ ≈ 95 phát).

**Lượt máy và lưu ván.** Ván (`tritue-banco:battleship:game`, phiên bản 1) lưu bố trí hai bên, lịch sử bắn, giai đoạn
(đặt tàu / lượt người / lượt máy / thắng / thua), độ khó và trạng thái RNG của máy — sau mỗi thay đổi, kể cả khi đang
đặt tàu. Khi tải, lịch sử được chơi lại trên hai hạm đội; bản lưu không khớp bị bỏ. Phát bắn của người chơi chuyển ván
sang “lượt máy” ngay lập tức (khóa thao tác); `match.js` lên lịch **một** tác vụ máy, chạy sau khi hiệu ứng xong. Tải lại
trang giữa lượt máy thì tiếp tục đúng một lượt (trạng thái lưu là “lượt máy, chưa bắn”); “Chơi mới” (có xác nhận khi
đang chơi) hủy tác vụ đang chờ và đổi token, nên callback cũ nếu vẫn chạy cũng bị bỏ qua. Hiệu ứng chỉ là hình ảnh, không
tham gia luật. Thống kê thắng/thua lưu riêng ở `battleship:stats`.

**Hạn chế.** Bố trí tàu của máy nằm trong localStorage dưới dạng JSON thường — ai mở công cụ dành cho nhà phát triển của
trình duyệt đều đọc được; trò chơi không tuyên bố bảo mật điều này. Máy mức Trung bình không phải máy tối ưu (không tính
xác suất đầy đủ cho mọi cấu hình). Chưa có điều khiển bằng bàn phím cho việc chọn ô bắn (chỉ chuột/cảm ứng; phím R/Esc
khi đặt tàu). Chỉ có chế độ đấu với máy, không có hai người.

## Game bài

Mọi game bài dùng chung `js/cards/`. Lá bài chỉ là dữ liệu bất biến `{ id, suit, rank, deck }`; ID dạng
`S12.0` (chất + hạng + số thứ tự bộ) nên nhiều bộ bài trong một ván không trùng ID. Trạng thái úp/ngửa là
một bản đồ `id → true` riêng, còn vị trí hiển thị do `view.js` tính lại từ trạng thái mỗi lần vẽ. Luật chơi
(`logic.js`) là hàm thuần nhận trạng thái và trả về trạng thái mới, không biết gì về p5 hay hoạt ảnh.

- **Seed:** mỗi ván có số ván (seed) hiển thị trên trang; cùng seed + cùng chế độ → cùng thứ tự chia
  (RNG Mulberry32 + Fisher–Yates). **Chơi lại ván này** chia lại đúng thứ tự đó.
- **Thao tác:** kéo thả bằng chuột hoặc cảm ứng; hoặc chạm một lá để chọn rồi chạm nơi đến. Chạm lại lá đang chọn
  (hoặc nhấp đúp) để tự chuyển tới chỗ phù hợp. Phím tắt: Ctrl+Z / U hoàn tác, H gợi ý, Esc bỏ chọn.
- **Hiển thị trên điện thoại:** góc mỗi lá có dải hạng + chất; khi cột dài, bước xòe được nén nhưng không nhỏ hơn
  dải này. Bài trên tay Blackjack xòe ngang chặt thì có thêm chất nhỏ dưới hạng ở mép trái.
- **Lưu tiến trình:** sau mỗi nước (khóa `klondike:game`, `freecell:game`, `spider:game`, `blackjack:session`),
  kèm lịch sử hoàn tác (tối đa 400 bước). Bản lưu bị thiếu/thừa/trùng lá bị bỏ qua. Đổi kích thước cửa sổ
  chỉ tính lại bố cục.
- **Gợi ý** chỉ trả về **một nước đi hợp lệ** theo thứ tự ưu tiên đơn giản (lên đích, lật lá úp, làm trống cột,
  ghép cùng chất…), loại các nước vô ích hiển nhiên. Đây **không** phải bộ giải và không bảo đảm nước tối ưu;
  khi không thấy nước có ích, trò chơi nói rõ thay vì gợi ý vòng lặp.

Luật đã chọn:

- **Klondike** — 52 lá, 7 cột (1–7 lá, chỉ lá trên ngửa), chồng rút / đã rút / 4 chồng đích. Cột: giảm dần xen kẽ
  màu; cột trống chỉ nhận K (hoặc chuỗi bắt đầu bằng K); chuyển được chuỗi ngửa hợp lệ. Đích: cùng chất A → K;
  được lấy lá từ đích về cột. Rút 1 hoặc 3 lá, **quay vòng không giới hạn**; chế độ 3 lá chỉ dùng lá trên cùng.
  Lá úp lộ ra được tự lật. Nút **Tự hoàn tất** khi mọi lá đã ngửa và hết bài rút. Không tính điểm kiểu Windows.
- **FreeCell** — 52 lá chia ngửa vào 8 cột (4 × 7, 4 × 6), 4 ô dự trữ, 4 chồng đích. Cột trống nhận bất kỳ lá
  hoặc chuỗi hợp lệ. Chuyển chuỗi giới hạn **(ô trống + 1) × 2^(cột trống)**, không tính cột đích nếu nó trống;
  chuỗi được thực hiện thật bằng các bước chuyển từng lá (`supermoveSteps`), mỗi bước kiểm tra theo luật một lá.
  Không lấy bài từ chồng đích xuống. Tùy chọn tự đưa lá “an toàn” lên đích (A, 2, và lá mà mọi lá khác màu nhỏ hơn
  1 hạng đã lên đích). Ván chia theo seed của trò chơi này (không theo số ván Microsoft); **không bảo đảm mọi ván
  đều có lời giải**.
- **Spider** — 104 lá (1 chất: 8 bộ ♠; 2 chất: 4 bộ ♠♥; 4 chất: 2 bộ đủ), 10 cột (4 × 6 lá, 6 × 5 lá), 50 lá chia
  thêm 5 lần. Đặt giảm dần bất kể chất; chỉ cầm chuỗi giảm dần **cùng chất**; cột trống nhận lá/chuỗi hợp lệ;
  không chia khi còn cột trống. Chuỗi K → A cùng chất ở cuối cột được tự thu (kể cả sau khi chia thêm), nằm trong
  cùng bước hoàn tác. Thắng khi thu đủ 8 chuỗi. Không tính điểm.
- **Blackjack** — **chỉ điểm ảo** (1.000 điểm mỗi phiên), không có tiền thật, nạp hay rút. Shoe 6 bộ, xáo lại
  **giữa hai ván** khi đã dùng ≥ 75% (234/312 lá). Cược tối thiểu 10, là **bội số của 10** để khoản trả 3:2 luôn là
  số nguyên (10 → 15). Nhà cái có lá úp, **peek** Blackjack khi lá ngửa là A hoặc lá 10 điểm; **dừng ở mọi 17,
  kể cả soft 17**. Hit, Stand, Double Down (chỉ 2 lá đầu, cần đủ điểm, đúng một lá rồi dừng); đạt 21 thì tự dừng.
  Blackjack tự nhiên trả 3:2 và được phân biệt với 21 từ ba lá trở lên (trả 1:1); hòa trả lại cược.
  Không có hoàn tác sau khi chia. **Chơi lại phiên này** xáo shoe y như đầu phiên (seed + số lần xáo) và trả về
  1.000 điểm.

Hạn chế hiện tại: chưa có Split, Insurance, Surrender trong Blackjack; chưa có bộ giải để biết trước ván
Klondike/FreeCell/Spider có giải được hay không; chưa có điểm số kiểu Windows (chỉ đếm nước đi và thời gian);
bàn nhiều cột (Spider 10 cột) trên màn hình rất hẹp (< 340 px) dùng lá khá nhỏ — xoay ngang sẽ dễ nhìn hơn.

## Chơi với máy (Cờ vua, Cờ tướng, Cờ đam, Cờ caro)

Mỗi trang có thẻ **Chế độ chơi**: Hai người / Chơi với máy, chọn bên quân và độ khó (Dễ, Trung bình,
Khó). Máy tính toán trong Web Worker (`js/common/ai-worker.js`, gọi qua `ai-client.js`) nên giao diện
không bị đứng; lượt tính bị hủy ngay khi hoàn tác, ván mới hoặc đổi chế độ. Hoàn tác lùi về lượt
trước của người chơi. Thuật toán nằm trong `js/games/<game>/ai.js`, tách khỏi giao diện và có kiểm thử:

- **Cờ vua** — negamax alpha-beta + tìm kiếm tĩnh (bắt quân), đánh giá vật chất + bảng điểm vị trí,
  sâu dần theo thời gian (Khó ≈ 1,8 giây/nước). Dùng các hàm nội bộ của chess.js 1.0.0 cho tốc độ.
- **Cờ tướng** — negamax alpha-beta + tìm kiếm tĩnh (chỉ nước ăn quân), gia hạn khi bị chiếu, xếp nước theo
  MVV-LVA + nước sát thủ, đánh giá vật chất + điểm vị trí đơn giản; nước tạo thế lặp lần ba được chấm như hòa.
  Sâu dần theo thời gian (Dễ 2 nửa nước + nhiễu, Trung bình ≤ 4 nửa nước ≈ 0,9 giây, Khó ≈ 2 giây/nước).
- **Cờ đam** — negamax alpha-beta trên trọn lượt (gộp chuỗi nhảy), không cắt ngang khi còn nước bắt.
- **Cờ caro** — chấm điểm mẫu quân (năm, bốn mở, bốn, ba mở…) cho tấn công + phòng thủ; mức Khó
  thêm tìm kiếm VCF (chuỗi nước bốn ép buộc) cho cả hai bên.

## Kiểm thử

```bash
node tests/run-all.mjs
```

Kiểm thử Cờ tướng (`tests/xiangqi.test.mjs`, `xiangqi-ai.test.mjs`): perft 1–3 từ thế ban đầu khớp số liệu chuẩn
(44 / 1 920 / 79 666), cản chân Mã, cản mắt Tượng, Tượng không qua sông, Pháo ăn qua một ngòi, Tốt trước/sau sông,
cung Tướng, cấm lộ mặt Tướng, chiếu bằng Mã/Pháo/Tốt, chiếu bí, vây khốn là thua, hòa lặp ba lần / 60 nước / hết quân
tấn công, ký hiệu Việt Nam, nước sai và bản lưu hỏng bị từ chối; máy thấy chiếu bí một nước, ăn quân miễn phí, không
để mất Xe, và mức Khó không thua mức Dễ trong tự đấu.

Kiểm thử Xếp gạch (`tests/tetris.test.mjs`): túi 7 đủ bảy loại và tái hiện theo seed, vị trí xuất hiện, trọng lực và
rơi nhanh, khóa trễ và giới hạn gia hạn, xóa 1–4 hàng và dồn hàng, lên cấp, B2B và combo, đá tường SRS, xoay bốn lần về
chỗ cũ, T-spin Đôi, giữ khối, thua do chặn đầu, lưu/tải bằng JSON (và từ chối bản lưu hỏng), cùng 30 ván ngẫu nhiên
không bao giờ có khối chồng lên ô đã khóa.

Kiểm thử Bắn tàu (`tests/battleship.test.mjs`): kích thước tàu, không vượt bàn/không chồng nhau, cho phép chạm nhau,
đặt ngẫu nhiên luôn đủ năm tàu hợp lệ trên 1.500 seed (kể cả khi giữ sẵn một số tàu), trúng/trượt/bắn lặp/sai lượt,
chuyển lượt sau khi trúng, chìm tàu, thắng/thua và khóa bàn, quan sát công khai không lộ tàu chưa chìm, máy không bắn
lặp qua 120 ván mô phỏng, máy chọn cùng ô với hai hạm đội khác nhau nhưng cùng quan sát, mẫu bàn cờ, nối dài theo trục,
quay lại dò, tàu nằm sát nhau, lưu/tải kiểm tra bằng cách chơi lại lịch sử, tải lại giữa lượt máy chỉ bắn một phát, và
ván mới không nhận tác vụ máy của ván cũ (cả khi callback cũ vẫn chạy).

Kiểm thử game bài (`tests/cards-deck`, `klondike`, `freecell`, `spider`, `blackjack`): số lá và ID duy nhất
(1, 6 bộ, Spider 1/2/4 chất), xáo bài không mất/thêm lá và tái hiện theo seed, luật chuyển hợp lệ/không hợp lệ,
hoàn tác, lưu → JSON → tải lại không đổi bài (và từ chối bản lưu hỏng), chơi lại cùng thứ tự chia, điều kiện thắng,
giới hạn chuyển chuỗi FreeCell (mọi tổ hợp 0–4 ô trống × 0–3 cột trống, kiểm từng bước một lá), thu chuỗi và chia
thêm trong Spider, gợi ý luôn là nước hợp lệ trên hàng chục ván ngẫu nhiên, và Blackjack: nhiều lá A, soft/hard 17,
Blackjack tự nhiên vs 21 ba lá, peek, Double Down, xáo lại ở 75%, bảo toàn điểm qua 500 ván.
