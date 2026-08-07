/**
 * Generates the PWA icons as PNGs with no image dependencies.
 *
 * The mark is a ring split into the four cycle phases, which is the one idea the
 * whole app rests on. Written by hand because pulling a rasteriser into the
 * toolchain to draw four arcs is not a trade worth making.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [0x0f, 0x11, 0x15];
const PHASES = [
  [0xd4, 0x52, 0x6e], // menstrual
  [0x35, 0xc4, 0x8f], // follicular
  [0xe8, 0xa3, 0x3d], // ovulatory
  [0x8b, 0x7c, 0xf0], // luteal
];

// ---- PNG plumbing ----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    rgb.copy(raw, row + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- the mark --------------------------------------------------------------

/** Colour of one sample point, or null for background. */
function sample(x, y, size) {
  const c = size / 2;
  const dx = x - c;
  const dy = y - c;
  const dist = Math.hypot(dx, dy);
  const outer = size * 0.40;
  const inner = size * 0.265;
  if (dist > outer || dist < inner) return null;

  // Start the menstrual arc at 12 o'clock and run clockwise.
  let a = Math.atan2(dx, -dy);
  if (a < 0) a += Math.PI * 2;
  const gap = 0.055; // small break between arcs
  const seg = (Math.PI * 2) / 4;
  const within = a % seg;
  if (within < gap || within > seg - gap) return null;
  return PHASES[Math.floor(a / seg)];
}

function render(size) {
  const buf = Buffer.alloc(size * size * 3);
  const SS = 3; // supersample factor for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const col = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size) ?? BG;
          r += col[0];
          g += col[1];
          b += col[2];
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 3;
      buf[i] = Math.round(r / n);
      buf[i + 1] = Math.round(g / n);
      buf[i + 2] = Math.round(b / n);
    }
  }
  return png(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(OUT, `icon-${size}.png`), render(size));
  console.log(`public/icon-${size}.png`);
}
