/**
 * Compact Client-Side Animated GIF89a Encoder (Pure TypeScript)
 * Uses a clean 6x6x6 web-safe RGB palette (216 colors) + LZW compression so
 * Video-to-GIF exports real, universally playable animated .gif files directly in the browser.
 */

function buildGlobalPalette(): Uint8Array {
  const palette = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        palette[idx++] = Math.round((r * 255) / 5);
        palette[idx++] = Math.round((g * 255) / 5);
        palette[idx++] = Math.round((b * 255) / 5);
      }
    }
  }
  // Fill remaining 40 slots with grayscale ramp for crisp UI & monochrome frames
  for (let i = 0; i < 40; i += 1) {
    const v = Math.round((i * 255) / 39);
    palette[idx++] = v;
    palette[idx++] = v;
    palette[idx++] = v;
  }
  return palette;
}

function quantizeFrameToIndices(rgba: Uint8ClampedArray): Uint8Array {
  const pixelCount = rgba.length / 4;
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const ri = Math.round((r * 5) / 255);
    const gi = Math.round((g * 5) / 255);
    const bi = Math.round((b * 5) / 255);
    indices[i] = ri * 36 + gi * 6 + bi;
  }
  return indices;
}

function lzwEncode(indices: Uint8Array, minCodeSize = 8): number[] {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;

  const outBytes: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const writeCode = (code: number, size: number) => {
    bitBuffer |= code << bitCount;
    bitCount += size;
    while (bitCount >= 8) {
      outBytes.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let dict = new Map<number, number>();
  const resetDict = () => {
    dict = new Map<number, number>();
    codeSize = minCodeSize + 1;
    nextCode = eoiCode + 1;
  };

  writeCode(clearCode, codeSize);
  let prefix = indices[0];

  for (let i = 1; i < indices.length; i += 1) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const existing = dict.get(key);
    if (existing !== undefined) {
      prefix = existing;
    } else {
      writeCode(prefix, codeSize);
      if (nextCode < 4096) {
        dict.set(key, nextCode);
        if (nextCode === 1 << codeSize && codeSize < 12) {
          codeSize += 1;
        }
        nextCode += 1;
      } else {
        writeCode(clearCode, codeSize);
        resetDict();
      }
      prefix = k;
    }
  }

  writeCode(prefix, codeSize);
  writeCode(eoiCode, codeSize);
  if (bitCount > 0) {
    outBytes.push(bitBuffer & 0xff);
  }
  return outBytes;
}

export function encodeAnimatedGif(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  delayCentiseconds = 10
): Blob {
  const bytes: number[] = [];
  const pushStr = (s: string) => {
    for (let i = 0; i < s.length; i += 1) bytes.push(s.charCodeAt(i));
  };
  const pushU16 = (v: number) => {
    bytes.push(v & 0xff, (v >> 8) & 0xff);
  };

  // GIF89a Header
  pushStr('GIF89a');
  // Logical Screen Descriptor
  pushU16(width);
  pushU16(height);
  bytes.push(0xf7, 0x00, 0x00); // Global color table flag + 8-bit palette (256 colors)

  // Global Color Table
  const palette = buildGlobalPalette();
  for (let i = 0; i < palette.length; i += 1) bytes.push(palette[i]);

  // NETSCAPE2.0 Application Extension (infinite loop)
  bytes.push(0x21, 0xff, 0x0b);
  pushStr('NETSCAPE2.0');
  bytes.push(0x03, 0x01, 0x00, 0x00, 0x00);

  const safeDelay = Math.max(2, Math.min(600, Math.round(delayCentiseconds)));

  for (const rgba of frames) {
    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04, 0x04);
    pushU16(safeDelay);
    bytes.push(0x00, 0x00);

    // Image Descriptor
    bytes.push(0x2c);
    pushU16(0);
    pushU16(0);
    pushU16(width);
    pushU16(height);
    bytes.push(0x00); // Use global palette

    // Image Data (LZW)
    const minCodeSize = 8;
    bytes.push(minCodeSize);
    const indices = quantizeFrameToIndices(rgba);
    const lzw = lzwEncode(indices, minCodeSize);

    // Chunk into sub-blocks of max 255 bytes
    for (let i = 0; i < lzw.length; i += 255) {
      const chunkLen = Math.min(255, lzw.length - i);
      bytes.push(chunkLen);
      for (let j = 0; j < chunkLen; j += 1) {
        bytes.push(lzw[i + j]);
      }
    }
    bytes.push(0x00); // Block terminator
  }

  bytes.push(0x3b); // GIF Trailer
  return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
}
