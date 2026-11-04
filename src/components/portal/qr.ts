// Minimal QR Code encoder: byte mode, error correction level M, versions 1–15
// (up to ~400 bytes, plenty for a portal link). Follows ISO/IEC 18004 and the
// structure of Project Nayuki's reference encoder. No dependencies.

const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
const MAX_VER = 15;
const FORMAT_M = 0; // ECC level M format bits

function rawDataModules(ver: number) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver] * BLOCKS_M[ver];

// ---------- Reed–Solomon over GF(2^8), poly 0x11D ----------

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree: number) {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data: number[], div: number[]) {
  const r = new Array<number>(div.length).fill(0);
  for (const b of data) {
    const f = b ^ (r.shift() as number);
    r.push(0);
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)));
  }
  return r;
}

// ---------- matrix ----------

class Matrix {
  m: boolean[][];
  fn: boolean[][];
  size: number;
  constructor(size: number) {
    this.size = size;
    this.m = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  set(x: number, y: number, dark: boolean) {
    this.m[y][x] = dark;
    this.fn[y][x] = true;
  }
}

const bit = (v: number, i: number) => ((v >>> i) & 1) !== 0;

function alignmentPositions(ver: number, size: number) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

function drawFormat(q: Matrix, mask: number) {
  const data = (FORMAT_M << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const s = q.size;
  for (let i = 0; i <= 5; i++) q.set(8, i, bit(bits, i));
  q.set(8, 7, bit(bits, 6));
  q.set(8, 8, bit(bits, 7));
  q.set(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) q.set(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) q.set(s - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) q.set(8, s - 15 + i, bit(bits, i));
  q.set(8, s - 8, true);
}

function drawFunctionPatterns(q: Matrix, ver: number) {
  const s = q.size;
  for (let i = 0; i < s; i++) {
    q.set(6, i, i % 2 === 0);
    q.set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < s && y >= 0 && y < s) q.set(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(s - 4, 3);
  finder(3, s - 4);
  const pos = alignmentPositions(ver, s);
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++)
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) q.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  drawFormat(q, 0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = bit(bits, i);
      const a = s - 11 + (i % 3);
      const c = Math.floor(i / 3);
      q.set(a, c, b);
      q.set(c, a, b);
    }
  }
}

function interleave(ver: number, data: number[]) {
  const nb = BLOCKS_M[ver];
  const eccLen = ECC_PER_BLOCK_M[ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++)
    for (let j = 0; j < blocks.length; j++) if (i !== shortLen - eccLen || j >= nShort) out.push(blocks[j][i]);
  return out;
}

function drawCodewords(q: Matrix, cw: number[]) {
  const s = q.size;
  let i = 0;
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < s; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? s - 1 - v : v;
        if (!q.fn[y][x] && i < cw.length * 8) {
          q.m[y][x] = bit(cw[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
  }
}

function maskHit(mask: number, x: number, y: number) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}
function applyMask(q: Matrix, mask: number) {
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (!q.fn[y][x] && maskHit(mask, x, y)) q.m[y][x] = !q.m[y][x];
}

/** Simplified penalty (runs, 2×2 blocks, dark balance) — any mask is valid, this only helps scanning */
function penalty(q: Matrix) {
  const s = q.size;
  let p = 0;
  for (let a = 0; a < s; a++) {
    let rr = 1;
    let rc = 1;
    for (let b = 1; b < s; b++) {
      if (q.m[a][b] === q.m[a][b - 1]) rr++;
      else {
        if (rr >= 5) p += rr - 2;
        rr = 1;
      }
      if (q.m[b][a] === q.m[b - 1][a]) rc++;
      else {
        if (rc >= 5) p += rc - 2;
        rc = 1;
      }
    }
    if (rr >= 5) p += rr - 2;
    if (rc >= 5) p += rc - 2;
  }
  let dark = 0;
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      if (q.m[y][x]) dark++;
      if (x < s - 1 && y < s - 1) {
        const c = q.m[y][x];
        if (c === q.m[y][x + 1] && c === q.m[y + 1][x] && c === q.m[y + 1][x + 1]) p += 3;
      }
    }
  const total = s * s;
  p += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return p;
}

/** Encode text as a QR matrix (true = dark). Throws if the text is too long. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= MAX_VER; ver++) {
    const cc = ver <= 9 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > MAX_VER) throw new Error("QR: text too long");
  const cap = dataCodewords(ver) * 8;
  const bits: number[] = [];
  const push = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const size = ver * 4 + 17;
  const base = new Matrix(size);
  drawFunctionPatterns(base, ver);
  drawCodewords(base, interleave(ver, data));

  let best: Matrix | null = null;
  let bestP = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const q = new Matrix(size);
    q.m = base.m.map((r) => r.slice());
    q.fn = base.fn;
    applyMask(q, mask);
    drawFormat(q, mask);
    const p = penalty(q);
    if (p < bestP) {
      bestP = p;
      best = q;
    }
  }
  return (best as Matrix).m;
}

/** SVG path data for the dark modules, with a 4-module quiet zone. Returns the viewBox size too. */
export function qrPath(text: string) {
  const m = qrMatrix(text);
  const border = 4;
  let d = "";
  m.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + border},${y + border}h1v1h-1z`)));
  return { d, size: m.length + border * 2 };
}
