// Quân cờ vua vẽ dạng vector bằng p5 (dùng được cho cả canvas chính lẫn p5.Graphics).
// Hệ tọa độ đơn vị 100×100, đáy quân ở y ≈ 90.

const STYLE = {
  w: { fill: '#fbf9f2', stroke: '#24222b', detail: '#24222b' },
  b: { fill: '#2b2933', stroke: '#0e0d12', detail: '#f1efe7' },
};

function base(g) {
  g.rect(22, 80, 56, 10, 4);
}

const SHAPES = {
  p(g) {
    base(g);
    g.beginShape();
    g.vertex(32, 81);
    g.bezierVertex(34, 66, 40, 58, 43, 52);
    g.vertex(57, 52);
    g.bezierVertex(60, 58, 66, 66, 68, 81);
    g.endShape(g.CLOSE);
    g.ellipse(50, 52, 28, 8);
    g.circle(50, 37, 23);
  },
  r(g) {
    base(g);
    g.quad(31, 81, 34, 42, 66, 42, 69, 81);
    g.beginShape();
    for (const [x, y] of [[26, 43], [26, 22], [35, 22], [35, 29], [44, 29], [44, 22], [56, 22], [56, 29], [65, 29], [65, 22], [74, 22], [74, 43]]) g.vertex(x, y);
    g.endShape(g.CLOSE);
    g.rect(28, 70, 44, 8, 2);
  },
  n(g, style) {
    base(g);
    g.beginShape();
    for (const [x, y] of [[29, 81], [33, 66], [44, 55], [35, 57], [26, 60], [19, 53], [21, 45], [33, 31], [42, 23], [46, 12], [53, 20], [63, 25], [72, 39], [75, 60], [71, 81]]) g.vertex(x, y);
    g.endShape(g.CLOSE);
    g.push();
    g.noStroke();
    g.fill(style.detail);
    g.circle(38, 36, 6);
    g.pop();
    g.push();
    g.noFill();
    g.stroke(style.detail);
    g.strokeWeight(2.5);
    g.line(55, 26, 66, 44);
    g.line(66, 44, 68, 66);
    g.pop();
  },
  b(g, style) {
    base(g);
    g.beginShape();
    g.vertex(35, 81);
    g.bezierVertex(26, 62, 33, 38, 50, 24);
    g.bezierVertex(67, 38, 74, 62, 65, 81);
    g.endShape(g.CLOSE);
    g.circle(50, 19, 10);
    g.ellipse(50, 72, 34, 8);
    g.push();
    g.stroke(style.detail);
    g.strokeWeight(3);
    g.line(56, 40, 46, 54);
    g.pop();
  },
  q(g) {
    base(g);
    g.beginShape();
    for (const [x, y] of [[30, 81], [21, 38], [33, 61], [35, 29], [44, 57], [50, 24], [56, 57], [65, 29], [67, 61], [79, 38], [70, 81]]) g.vertex(x, y);
    g.endShape(g.CLOSE);
    for (const [x, y] of [[21, 36], [35, 27], [50, 21], [65, 27], [79, 36]]) g.circle(x, y, 9);
    g.ellipse(50, 72, 42, 8);
  },
  k(g) {
    base(g);
    g.beginShape();
    g.vertex(30, 81);
    g.bezierVertex(20, 60, 28, 44, 50, 47);
    g.bezierVertex(72, 44, 80, 60, 70, 81);
    g.endShape(g.CLOSE);
    g.ellipse(50, 45, 18, 16);
    g.rect(46.5, 12, 7, 26, 2);
    g.rect(40, 18, 20, 7, 2);
    g.ellipse(50, 72, 42, 8);
  },
};

/** Vẽ quân `type` (p n b r q k) màu `color` (w b) với tâm ô (cx, cy) và cạnh ô `size`. */
export function drawPiece(g, type, color, cx, cy, size) {
  const style = STYLE[color];
  g.push();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 100);
  g.fill(style.fill);
  g.stroke(style.stroke);
  g.strokeWeight(3);
  g.strokeJoin(g.ROUND);
  SHAPES[type](g, style);
  g.pop();
}

/** Tạo ảnh dataURL của quân cờ để dùng trong HTML (quân bị bắt, hộp thoại phong cấp). */
const iconCache = new Map();
export function pieceIcon(p, type, color, px = 64) {
  const key = `${color}${type}${px}`;
  if (iconCache.has(key)) return iconCache.get(key);
  const g = p.createGraphics(px, px);
  g.pixelDensity(2);
  g.clear();
  drawPiece(g, type, color, px / 2, px / 2, px);
  const url = g.elt.toDataURL('image/png');
  g.remove();
  iconCache.set(key, url);
  return url;
}
