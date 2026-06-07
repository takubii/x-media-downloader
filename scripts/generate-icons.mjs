import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

const sizes = [16, 32, 48, 128];

for (const size of sizes) {
  const path = `public/icons/icon${size}.png`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodePng(size, drawIcon(size)));
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const pad = Math.max(2, Math.round(size / 8));
  const left = pad;
  const top = pad;
  const right = size - pad;
  const bottom = size - pad;
  const radius = Math.max(2, Math.round(size / 8));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (insideRoundedRect(x, y, left, top, right, bottom, radius)) {
        const mix = (y - top) / Math.max(1, bottom - top);
        setPixel(pixels, size, x, y, blend([37, 99, 235], [14, 165, 233], mix), 255);
      }
    }
  }

  const trayTop = Math.round(size * 0.66);
  const trayLeft = Math.round(size * 0.28);
  const trayRight = Math.round(size * 0.72);
  const trayBottom = Math.round(size * 0.76);
  fillRoundedRect(
    pixels,
    size,
    trayLeft,
    trayTop,
    trayRight,
    trayBottom,
    Math.max(1, size / 32),
    [255, 255, 255],
  );

  const cx = Math.round(size / 2);
  const arrowTop = Math.round(size * 0.28);
  const arrowBottom = Math.round(size * 0.6);
  const stemWidth = Math.max(2, Math.round(size * 0.12));
  const headSize = Math.max(3, Math.round(size * 0.18));

  fillRect(
    pixels,
    size,
    cx - Math.floor(stemWidth / 2),
    arrowTop,
    cx + Math.ceil(stemWidth / 2),
    arrowBottom,
    [255, 255, 255],
  );
  fillTriangle(
    pixels,
    size,
    cx,
    arrowBottom + headSize,
    cx - headSize,
    arrowBottom - Math.floor(headSize / 2),
    cx + headSize,
    arrowBottom - Math.floor(headSize / 2),
    [255, 255, 255],
  );

  return pixels;
}

function encodePng(size, pixels) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const sourceStart = y * size * 4;
    const targetStart = y * (size * 4 + 1);
    raw[targetStart] = 0;
    Buffer.from(pixels.buffer, sourceStart, size * 4).copy(raw, targetStart + 1);
  }

  return Buffer.concat([
    header,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return (
    x >= left && x < right && y >= top && y < bottom && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
  );
}

function setPixel(pixels, size, x, y, [r, g, b], a = 255) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 4;
  pixels[offset] = r;
  pixels[offset + 1] = g;
  pixels[offset + 2] = b;
  pixels[offset + 3] = a;
}

function blend(from, to, mix) {
  return from.map((value, index) => Math.round(value + (to[index] - value) * mix));
}

function fillRect(pixels, size, left, top, right, bottom, color) {
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      setPixel(pixels, size, x, y, color);
    }
  }
}

function fillRoundedRect(pixels, size, left, top, right, bottom, radius, color) {
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      if (insideRoundedRect(x, y, left, top, right, bottom, radius)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function fillTriangle(pixels, size, ax, ay, bx, by, cx, cy, color) {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = edge(bx, by, cx, cy, x, y);
      const w1 = edge(cx, cy, ax, ay, x, y);
      const w2 = edge(ax, ay, bx, by, x, y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function edge(ax, ay, bx, by, x, y) {
  return (x - ax) * (by - ay) - (y - ay) * (bx - ax);
}
