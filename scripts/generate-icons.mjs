import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

const sourcePath = "public/icons/icon128.png";
const sizes = [16, 32, 48, 128];

const sourceImage = decodePng(await readFile(sourcePath));
if (sourceImage.width !== sourceImage.height) {
  throw new Error(`Icon source must be square: ${sourceImage.width}x${sourceImage.height}`);
}

for (const size of sizes) {
  const path = `public/icons/icon${size}.png`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, encodePng(size, resizeImage(sourceImage, size)));
}

function decodePng(buffer) {
  validatePngSignature(buffer);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }

  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  if (interlace !== 0) {
    throw new Error("Interlaced PNG files are not supported.");
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * 4);

  let rawOffset = 0;
  let previousRow = new Uint8Array(stride);

  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset];
    rawOffset += 1;

    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;

    const reconstructed = reconstructRow(row, previousRow, filterType, channels);
    copyRowToRgba(reconstructed, pixels, width, y, channels);
    previousRow = reconstructed;
  }

  return { width, height, pixels };
}

function validatePngSignature(buffer) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (const [index, byte] of signature.entries()) {
    if (buffer[index] !== byte) {
      throw new Error("Icon source must be a PNG file.");
    }
  }
}

function reconstructRow(row, previousRow, filterType, channels) {
  const output = new Uint8Array(row.length);

  for (let index = 0; index < row.length; index++) {
    const left = index >= channels ? output[index - channels] : 0;
    const up = previousRow[index] ?? 0;
    const upLeft = index >= channels ? previousRow[index - channels] : 0;
    const value = row[index];

    if (filterType === 0) {
      output[index] = value;
    } else if (filterType === 1) {
      output[index] = (value + left) & 0xff;
    } else if (filterType === 2) {
      output[index] = (value + up) & 0xff;
    } else if (filterType === 3) {
      output[index] = (value + Math.floor((left + up) / 2)) & 0xff;
    } else if (filterType === 4) {
      output[index] = (value + paethPredictor(left, up, upLeft)) & 0xff;
    } else {
      throw new Error(`Unsupported PNG filter type: ${filterType}`);
    }
  }

  return output;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function copyRowToRgba(row, pixels, width, y, channels) {
  for (let x = 0; x < width; x++) {
    const rowOffset = x * channels;
    const pixelOffset = (y * width + x) * 4;
    pixels[pixelOffset] = row[rowOffset];
    pixels[pixelOffset + 1] = row[rowOffset + 1];
    pixels[pixelOffset + 2] = row[rowOffset + 2];
    pixels[pixelOffset + 3] = channels === 4 ? row[rowOffset + 3] : 255;
  }
}

function resizeImage(image, size) {
  const pixels = new Uint8Array(size * size * 4);
  const scale = image.width / size;

  for (let y = 0; y < size; y++) {
    const sourceY = (y + 0.5) * scale - 0.5;
    const y0 = clamp(Math.floor(sourceY), 0, image.height - 1);
    const y1 = clamp(y0 + 1, 0, image.height - 1);
    const yMix = sourceY - y0;

    for (let x = 0; x < size; x++) {
      const sourceX = (x + 0.5) * scale - 0.5;
      const x0 = clamp(Math.floor(sourceX), 0, image.width - 1);
      const x1 = clamp(x0 + 1, 0, image.width - 1);
      const xMix = sourceX - x0;

      const targetOffset = (y * size + x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        pixels[targetOffset + channel] = Math.round(
          bilinearSample(image, x0, x1, y0, y1, xMix, yMix, channel),
        );
      }
    }
  }

  return pixels;
}

function bilinearSample(image, x0, x1, y0, y1, xMix, yMix, channel) {
  const top =
    getChannel(image, x0, y0, channel) * (1 - xMix) + getChannel(image, x1, y0, channel) * xMix;
  const bottom =
    getChannel(image, x0, y1, channel) * (1 - xMix) + getChannel(image, x1, y1, channel) * xMix;
  return top * (1 - yMix) + bottom * yMix;
}

function getChannel(image, x, y, channel) {
  return image.pixels[(y * image.width + x) * 4 + channel];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
