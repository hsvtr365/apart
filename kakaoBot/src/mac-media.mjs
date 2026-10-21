import { open, realpath, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_IMAGE = 8 * 1024 * 1024;
export const MAX_TOTAL = 16 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export class MediaError extends Error {
  constructor(code, retryable = false) { super(code); this.code = code; this.retryable = retryable; }
}
const reject = code => { throw new MediaError(code); };

// Only the full-size URL recorded by KakaoTalk is eligible. Never use thumbnailUrl,
// a message URL, redirects, transforms, user-configured hosts, or HTTP credentials.
export function originalURL(value) {
  let u;
  try { u = new URL(value); } catch { reject('media-url-invalid'); }
  if (u.protocol !== 'https:' || u.hostname !== 'talk.kakaocdn.net' || u.port
    || u.username || u.password || u.hash || u.href.length > 4096
    || !/^\/dna\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/.test(u.pathname)) reject('media-url-denied');
  const keys = [...u.searchParams.keys()].sort();
  if (keys.join(',') !== 'credential,expires,signature'
    || keys.some(k => !u.searchParams.get(k))) reject('media-url-query-denied');
  return u;
}

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19 || b === 51))
      || (a === 203 && b === 0));
  }
  // Reject mapped IPv4, loopback, link-local, ULA, multicast and reserved ranges.
  return family === 6 && /^2[0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
}

export async function downloadOriginal(value, expectedSize) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > MAX_IMAGE) reject('media-size-invalid');
  const u = originalURL(value);
  let addresses;
  try { addresses = await lookup(u.hostname, { all: true }); }
  catch { throw new MediaError('media-dns-unavailable', true); }
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) reject('media-address-denied');
  const selected = addresses.find(a => a.family === 4) ?? addresses[0];
  return new Promise((resolve, fail) => {
    let settled = false;
    const finish = (err, bytes) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      err ? fail(err) : resolve(bytes);
    };
    const req = https.get(u, {
      agent: false,
      headers: { 'Accept-Encoding': 'identity', Accept: 'image/jpeg,image/png,image/webp' },
      // Pin the checked DNS answer for this request, retaining TLS host verification.
      lookup: (_host, options, callback) => options.all
        ? callback(null, [selected]) : callback(null, selected.address, selected.family),
    }, res => {
      if (res.statusCode !== 200) {
        res.destroy();
        finish(new MediaError('media-http-' + res.statusCode, res.statusCode >= 500));
        return;
      }
      const length = Number(res.headers['content-length']);
      const type = String(res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (!MIME.has(type) || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
        || (res.headers['content-length'] !== undefined && length !== expectedSize)) {
        res.destroy(); finish(new MediaError('media-response-mismatch')); return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_IMAGE || size > expectedSize) {
          res.destroy(); finish(new MediaError('media-too-large')); return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => finish(null, Buffer.concat(chunks)));
      res.on('error', () => finish(new MediaError('media-download-interrupted', true)));
    });
    const deadline = setTimeout(() => {
      finish(new MediaError('media-download-timeout', true)); req.destroy();
    }, 20_000);
    req.on('error', () => finish(new MediaError('media-download-unavailable', true)));
  });
}

export function inspectImage(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_IMAGE) reject('media-size-invalid');
  let mime, width, height, orientation = 1;
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png'; width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
    if (!bytes.subarray(-8, -4).equals(Buffer.from('IEND'))) reject('media-png-truncated');
  } else if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mime = 'image/jpeg';
    let pos = 2;
    while (pos + 4 <= bytes.length) {
      if (bytes[pos++] !== 0xff) reject('media-jpeg-invalid');
      while (bytes[pos] === 0xff) pos++;
      const marker = bytes[pos++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (pos + 2 > bytes.length) reject('media-jpeg-invalid');
      const size = bytes.readUInt16BE(pos);
      if (size < 2 || pos + size > bytes.length) reject('media-jpeg-invalid');
      if (marker === 0xe1 && bytes.toString('ascii', pos + 2, pos + 8) === 'Exif\0\0') {
        const tiff = pos + 8, end = pos + size;
        const little = bytes.toString('ascii', tiff, tiff + 2) === 'II';
        const u16 = at => at + 2 <= end ? (little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)) : 0;
        const u32 = at => at + 4 <= end ? (little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at)) : 0;
        if (u16(tiff + 2) === 42) {
          const ifd = tiff + u32(tiff + 4), count = Math.min(u16(ifd), 1024);
          for (let i = 0; i < count; i++) {
            const at = ifd + 2 + i * 12;
            if (at + 12 > end) break;
            if (u16(at) === 0x112 && u16(at + 2) === 3 && u32(at + 4) === 1) orientation = u16(at + 8);
          }
        }
      }
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 8) reject('media-jpeg-invalid');
        height = bytes.readUInt16BE(pos + 3); width = bytes.readUInt16BE(pos + 5);
        break;
      }
      pos += size;
    }
    const eoi = bytes.lastIndexOf(Buffer.from([0xff, 0xd9]));
    // Samsung originals may carry a SEFT trailer after JPEG EOI. Preserve it.
    if (eoi < pos || (eoi !== bytes.length - 2
      && !(bytes.length - eoi <= 65536 && bytes.toString('ascii', bytes.length - 4) === 'SEFT'))) reject('media-jpeg-truncated');
    if ([5, 6, 7, 8].includes(orientation)) [width, height] = [height, width];
  } else if (bytes.length >= 30 && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length) {
    mime = 'image/webp';
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X') {
      width = 1 + bytes.readUIntLE(24, 3); height = 1 + bytes.readUIntLE(27, 3);
    } else if (kind === 'VP8L' && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff);
    } else if (kind === 'VP8 ' && bytes.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      width = bytes.readUInt16LE(26) & 0x3fff; height = bytes.readUInt16LE(28) & 0x3fff;
    }
  }
  if (!mime || !width || !height || width > 32768 || height > 32768 || width * height > 100_000_000) reject('media-format-invalid');
  return { mime, width, height, bytes: bytes.length };
}

export async function readLocalOriginal(filename, roots, expectedSize) {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > MAX_IMAGE) reject('media-size-invalid');
  if (typeof filename !== 'string' || !path.isAbsolute(filename) || filename.includes('\0')
    || !/\.(?:jpe?g|png|webp)$/i.test(filename)) reject('media-path-denied');
  const resolved = await realpath(filename).catch(() => { throw new MediaError('media-local-unavailable', true); });
  const normalized = path.resolve(filename);
  // Reject symlinks in the complete path, including ancestors and the leaf.
  if (normalized !== resolved || !roots.some(root => resolved.startsWith(path.resolve(root) + path.sep))) reject('media-path-denied');
  const stat = await lstat(resolved);
  if (!stat.isFile() || stat.size !== expectedSize || stat.size > MAX_IMAGE) reject('media-local-size-invalid');
  const file = await open(resolved, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size !== expectedSize || before.ino !== stat.ino || before.dev !== stat.dev) reject('media-local-changed');
    const bytes = Buffer.alloc(expectedSize + 1);
    let size = 0;
    while (size < bytes.length) {
      const read = await file.read(bytes, size, bytes.length - size, null);
      if (!read.bytesRead) break;
      size += read.bytesRead;
    }
    const after = await file.stat();
    if (size !== expectedSize || after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || await realpath(filename) !== resolved) reject('media-local-changed');
    return bytes.subarray(0, size);
  } finally { await file.close(); }
}

export function kakaoMediaRoots(home = os.homedir()) {
  const base = path.join(home, 'Library/Containers/com.kakao.KakaoTalkMac/Data');
  return [path.join(base, 'tmp'), path.join(base, 'Library/Caches/Items')];
}

export async function resolvePhotos(rows, { roots = kakaoMediaRoots(), download = downloadOriginal, read = readLocalOriginal } = {}) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 6) reject('media-count-invalid');
  const images = [], summaries = [], parsed = [];
  let total = 0;
  for (const row of rows) {
    let a;
    try { a = JSON.parse(row.attachment); } catch { reject('media-attachment-invalid'); }
    // Verified against NTChatMessage type=2 on this Mac. Albums and other
    // attachment schemas stay blocked until separately observed and validated.
    if (row.messageType !== 2 || !a || Array.isArray(a) || !MIME.has(a.mt)
      || !Number.isSafeInteger(a.s) || a.s < 1 || a.s > MAX_IMAGE
      || !Number.isInteger(a.w) || !Number.isInteger(a.h) || a.w < 1 || a.h < 1) reject('media-metadata-invalid');
    total += a.s;
    if (total > MAX_TOTAL) reject('media-total-too-large');
    parsed.push({ row, a });
  }
  for (const { row, a } of parsed) {
    let bytes, source;
    if (row.localFilePath) {
      bytes = await read(row.localFilePath, roots, a.s); source = 'local';
    } else {
      const url = originalURL(a.url);
      const parts = typeof a.k === 'string' ? a.k.split('/') : [];
      const urlParts = url.pathname.split('/').slice(2);
      if (parts.length !== 4 || parts[0] !== urlParts[0] || parts[1] !== urlParts[1]
        || parts[3] !== urlParts[3]) reject('media-resource-mismatch');
      bytes = await download(a.url, a.s); source = 'kakao-cdn-original';
    }
    const info = inspectImage(bytes);
    if (info.bytes !== a.s || info.mime !== a.mt || info.width !== a.w || info.height !== a.h) reject('media-original-mismatch');
    images.push({ mime: info.mime, base64: bytes.toString('base64') });
    summaries.push({ ...info, source });
  }
  return { images, summaries };
}
