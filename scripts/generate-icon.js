/**
 * 生成 AutoMatch 应用图标
 * 使用 Node.js 内置模块创建 PNG（无外部依赖）
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZE = 512;
const HALF = SIZE / 2;

function createCRC32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crcV = createCRC32(crcData);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcV);
  return Buffer.concat([len, typeB, data, crcB]);
}

function pixel(x, y, r, g, b, a) {
  return Buffer.from([r, g, b, a]);
}

// 判断点是否在圆内
function inCircle(cx, cy, r, x, y) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// 判断点在弧形区域
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
const BG_TOP = [30, 20, 60];     // 深紫黑
const BG_BOTTOM = [15, 60, 40];  // 深绿黑

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const t = y / SIZE; // 0~1

    // 背景渐变
    const bgR = Math.round(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t);
    const bgG = Math.round(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t);
    const bgB = Math.round(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t);

    // 外发光效果 - 圆形遮罩
    const distFromCenter = dist(x, y, HALF, HALF);
    const maxDist = HALF;
    let alpha = 1;
    if (distFromCenter > HALF - 8) {
      // 边缘羽化
      alpha = Math.max(0, 1 - (distFromCenter - (HALF - 8)) / 8);
    }

    if (alpha < 0.01) {
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = 0;
      continue;
    }

    let r = bgR, g = bgG, b = bgB;

    // 绘制足球图案
    const cx = HALF, cy = HALF;
    const ballR = HALF * 0.65;

    if (inCircle(cx, cy, ballR, x, y)) {
      // 足球背景 - 白色
      r = 245; g = 245; b = 245;

      // 足球五边形花纹
      const pentR = ballR * 0.45;
      for (let p = 0; p < 5; p++) {
        const angle = p * (2 * Math.PI / 5) - Math.PI / 2;
        const px = cx + Math.cos(angle) * pentR * 0.6;
        const py = cy + Math.sin(angle) * pentR * 0.6;

        const d = dist(x, y, px, py);
        if (d < pentR * 0.35) {
          // 五边形中心为黑色
          const intensity = Math.min(1, d / (pentR * 0.35));
          r = Math.round(245 - intensity * 100);
          g = Math.round(245 - intensity * 100);
          b = Math.round(245 - intensity * 100);
        }
      }

      // 足球缝线
      for (let i = 0; i < 5; i++) {
        const a1 = i * (2 * Math.PI / 5) - Math.PI / 2;
        const a2 = ((i + 1) % 5) * (2 * Math.PI / 5) - Math.PI / 2;
        for (let t = 0; t <= 1; t += 0.005) {
          const lx = cx + Math.cos(a1 + (a2 - a1) * t) * ballR * 0.65;
          const ly = cy + Math.sin(a1 + (a2 - a1) * t) * ballR * 0.65;
          if (dist(x, y, lx, ly) < 3) {
            r = 80; g = 80; b = 80;
          }
        }
      }

      // 球的边缘阴影
      const edgeT = distFromCenter / (ballR * SIZE / SIZE);
      if (edgeT > 0.7) {
        const shade = (edgeT - 0.7) / 0.3;
        r = Math.round(r * (1 - shade * 0.3));
        g = Math.round(g * (1 - shade * 0.3));
        b = Math.round(b * (1 - shade * 0.3));
      }
    }

    // 底部高光
    const gleamX = HALF - ballR * 0.3, gleamY = HALF - ballR * 0.3;
    const gleamD = dist(x, y, gleamX, gleamY);
    if (gleamD < ballR * 0.25) {
      const intensity = 1 - gleamD / (ballR * 0.25);
      r = Math.min(255, r + Math.round(intensity * 40));
      g = Math.min(255, g + Math.round(intensity * 40));
      b = Math.min(255, b + Math.round(intensity * 40));
    }

    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = Math.round(alpha * 255);
  }
}

// 构建 PNG
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);  // width
ihdr.writeUInt32BE(SIZE, 4);  // height
ihdr.writeUInt8(8, 8);        // bit depth
ihdr.writeUInt8(6, 9);        // color type (RGBA)
ihdr.writeUInt8(0, 10);       // compression
ihdr.writeUInt8(0, 11);       // filter
ihdr.writeUInt8(0, 12);       // interlace

// 每行前加 filter byte (0 = None)
const rawRows = [];
for (let y = 0; y < SIZE; y++) {
  const row = Buffer.alloc(1 + SIZE * 4);
  row[0] = 0; // filter byte
  pixels.copy(row, 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  rawRows.push(row);
}
const rawData = Buffer.concat(rawRows);
const compressed = zlib.deflateSync(rawData);

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log(`✅ 已生成 512x512 PNG 图标: build/icon.png (${(png.length / 1024).toFixed(1)} KB)`);
