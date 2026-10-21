import { timingSafeEqual } from 'node:crypto';

export function authorized(value, secret) {
  if (!secret || secret.length < 32 || typeof value !== 'string') return false;
  const a = Buffer.from(value), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function jsonFetch(url, init = {}, timeout = 180_000) {
  const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeout), redirect: 'error' });
  if (!res.ok) throw new Error(`upstream:${res.status}`);
  return res.json();
}

export async function readJson(req, limit = 24 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request-too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
