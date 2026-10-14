// Rebuild the PNG app icons from the Slink mark used in slink-icon.svg.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT = __dirname;
const SIZE = 512;
const COLORS = {
  background: [0x12, 0x3f, 0x35],
  mark: [0xf7, 0xf8, 0xf4],
  accent: [0xc8, 0xf3, 0x6c],
};
const LOGO = [
  [132,131],[380,131],[380,209],[210,209],[210,243],[380,243],
  [380,381],[132,381],[132,303],[302,303],[302,269],[132,269],
];

function insidePolygon(x, y) {
  let inside = false;
  for (let i = 0, j = LOGO.length - 1; i < LOGO.length; j = i++) {
    const [xi, yi] = LOGO[i];
    const [xj, yj] = LOGO[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function insideRoundedSquare(x, y) {
  const radius = 120;
  const cx = x < radius ? radius : x > SIZE - radius ? SIZE - radius : x;
  const cy = y < radius ? radius : y > SIZE - radius ? SIZE - radius : y;
  return (x-cx)**2 + (y-cy)**2 <= radius**2 || (x >= radius && x <= SIZE-radius) || (y >= radius && y <= SIZE-radius);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, checksum]);
}

function render(size, fileName, maskable) {
  const samples = 3;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const counts = [0,0,0,0];
      for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
        const px = (x + (sx + 0.5) / samples) * SIZE / size;
        const py = (y + (sy + 0.5) / samples) * SIZE / size;
        if (!maskable && !insideRoundedSquare(px, py)) continue;
        let color = COLORS.background;
        if ((px-389)**2 + (py-120)**2 <= 32**2) color = COLORS.accent;
        else if (insidePolygon(px, py)) color = COLORS.mark;
        counts[0] += color[0]; counts[1] += color[1]; counts[2] += color[2]; counts[3] += 255;
      }
      const offset = 1 + x * 4;
      for (let c = 0; c < 4; c++) row[offset+c] = Math.round(counts[c] / (samples*samples));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(OUT, fileName), png);
}

render(180, 'slink-icon-180.png');
render(192, 'slink-icon-192.png');
render(512, 'slink-icon-512.png');
render(512, 'slink-icon-maskable-512.png', true);
