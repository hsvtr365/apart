import { mkdirSync, chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KakaoSource, numericId } from './mac-source.mjs';
import { resolvePhotos, MediaError } from './mac-media.mjs';
import { createAI } from './ai.mjs';
import { createApp } from './app.mjs';
import { createEngine } from './engine.mjs';
import { openStore } from './store.mjs';
import { SiteTunnel } from './tunnel.mjs';
import { acquireLock } from './process-lock.mjs';
import { BotError } from './errors.mjs';
export { parseMessage } from './mac-source.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const CODES = new Set(['kakao-db-unavailable', 'send-policy-unavailable', 'send-policy-mismatch', 'send-uncertain', 'invalid-reply',
  'macOS-required', 'configure-rooms', 'invalid-numeric-id', 'bridge-stopping']);
const codeOf = e => e instanceof MediaError || e instanceof BotError ? e.code : CODES.has(e?.message) ? e.message : 'bridge-internal-error';

export class Inbox {
  constructor(filename) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE IF NOT EXISTS room_cursor (room TEXT PRIMARY KEY, logid TEXT NOT NULL);`);
  }
  cursor(room) { return this.db.prepare('SELECT logid FROM room_cursor WHERE room=?').get(room)?.logid; }
  setCursor(room, id) { this.db.prepare('INSERT OR REPLACE INTO room_cursor VALUES(?,?)').run(room, id); }
  accept(room, events) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const event of events) {
        this.db.prepare('INSERT OR IGNORE INTO inbox(id,payload) VALUES(?,?)').run(`${room}:${event.id}`, JSON.stringify(event));
        this.setCursor(room, event.id);
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  pending() { return this.db.prepare("SELECT * FROM inbox WHERE status='pending' ORDER BY rowid LIMIT 1").get(); }
  finish(id, status) {
    this.db.prepare('UPDATE inbox SET status=?,payload=? WHERE id=?').run(status, '{}', id);
  }
  claimSend(id) {
    return this.db.prepare("UPDATE inbox SET status='uncertain',payload='{}' WHERE id=? AND status='pending'").run(id).changes === 1;
  }
  counts() { return this.db.prepare('SELECT status,COUNT(*) AS count FROM inbox GROUP BY status').all(); }
  close() { this.db.close(); }
}

export async function deliverOne({ inbox, source, processEvent, send = (e, reply) => source.send(e, reply), media = resolvePhotos }) {
  const row = inbox.pending();
  if (!row) return false;
  const raw = JSON.parse(row.payload);
  if (!source.rooms.includes(raw.roomId) || raw.senderId === source.selfId || ![1, 2, 27].includes(raw.messageType)) {
    inbox.finish(row.id, 'ignored'); return true;
  }
  if (raw.messageType === 27) {
    inbox.finish(row.id, 'blocked'); throw new MediaError('media-album-schema-unverified');
  }
  if (typeof raw.text !== 'string' || raw.text.length > 3000) {
    inbox.finish(row.id, 'blocked'); throw new MediaError('event-text-invalid');
  }
  let images = [];
  if (raw.messageType === 2) {
    try { ({ images } = await media(await source.photo(raw))); }
    catch (e) {
      if (e instanceof MediaError && !e.retryable) inbox.finish(row.id, 'blocked');
      throw e;
    }
  }
  const event = { id: raw.id, roomId: raw.roomId, senderId: raw.senderId, text: raw.text, images };
  const result = await processEvent(event);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid-reply');
  if (result.ignored === true || result.reply == null || result.reply === '') {
    inbox.finish(row.id, 'done'); return true;
  }
  if (typeof result.reply !== 'string' || result.reply.length > 10000) {
    inbox.finish(row.id, 'blocked'); throw new Error('invalid-reply');
  }
  // Persist before the UI side effect. Uncertain sends are never retried.
  if (!inbox.claimSend(row.id)) return true;
  await send(event, result.reply);
  inbox.finish(row.id, 'done');
  return true;
}

export async function main(env = process.env) {
  if (process.platform !== 'darwin') throw new Error('macOS-required');
  const rooms = (env.ALLOWED_ROOM_IDS || '').split(',').filter(Boolean).map(numericId);
  if (!rooms.length || new Set(rooms).size !== rooms.length) throw new Error('configure-rooms');
  const source = new KakaoSource(env.KAKAOCLI_BIN || 'kakaocli', rooms, env.BOT_SENDER_ID);
  await source.assertPolicy();
  const dir = path.resolve(env.MAC_STATE_DIR || './data/mac');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const checkOnly = process.argv.includes('--check');
  const releaseLock = checkOnly ? () => {} : acquireLock(path.join(dir, 'bot.lock'));
  const filename = path.join(dir, 'mac-inbox.sqlite');
  const previousMask = process.umask(0o077);
  const inbox = new Inbox(filename);
  process.umask(previousMask);
  chmodSync(filename, 0o600);
  let stopped = false;
  const abort = new AbortController();
  let store, engine;
  const tunnel = new SiteTunnel();
  const stop = () => { stopped = true; abort.abort(); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  let lastError = '', lastLoggedAt = 0, nextDeliveryAt = 0, failures = 0, lastSentAt = 0, tunnelWarningAt = 0;
  try {
    const app = createApp(env, { signal: abort.signal });
    store = openStore(path.join(dir, 'engine'));
    engine = createEngine({ env, ai: createAI(env, { signal: abort.signal }), app, store });
    for (const room of rooms) {
      if (inbox.cursor(room) === undefined) inbox.setCursor(room, await source.latest(room));
    }
    console.log(JSON.stringify({ event: 'mac-bot-ready', rooms, selfId: source.selfId, appConfigured: app.configured,
      model: env.GEMMA_MODEL || 'gemma4:26b', qwenEnabled: false }));
    if (checkOnly) {
      console.log(JSON.stringify({ event: 'inbox-status', counts: inbox.counts(), publications: store.counts() })); return;
    }
    while (!stopped) {
      try {
        const tunnelReady = await tunnel.ensure();
        if (!tunnelReady && Date.now() - tunnelWarningAt > 60_000) {
          console.error(JSON.stringify({ event: 'bridge-attention', code: 'tunnel-unavailable' })); tunnelWarningAt = Date.now();
        }
        for (const room of rooms) {
          const events = await source.poll(room, inbox.cursor(room));
          inbox.accept(room, events);
          if (events.length) console.log(JSON.stringify({ event: 'captured', roomId: room, count: events.length }));
        }
        if (Date.now() >= nextDeliveryAt) {
          const didWork = await deliverOne({ inbox, source, processEvent: async event => {
            const result = await engine.process(event);
            if (result.code) console.error(JSON.stringify({ event: 'bot-attention', code: result.code }));
            return result;
          }, send: async (event, reply) => {
            if (stopped) throw new Error('bridge-stopping');
            await sleep(Math.max(0, 2000 - (Date.now() - lastSentAt)));
            await source.send(event, reply);
            lastSentAt = Date.now();
          } });
          if (didWork) console.log(JSON.stringify({ event: 'delivery-complete' }));
          failures = 0; lastError = '';
        }
      } catch (e) {
        const code = codeOf(e);
        failures++;
        nextDeliveryAt = Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(failures, 5));
        if (code !== lastError || Date.now() - lastLoggedAt > 60_000) {
          console.error(JSON.stringify({ event: 'bridge-attention', code }));
          lastError = code; lastLoggedAt = Date.now();
        }
      }
      if (!stopped) await sleep(2000);
    }
  } finally {
    console.log(JSON.stringify({ event: 'bridge-stopped', counts: inbox.counts() }));
    abort.abort();
    await tunnel.close();
    engine?.close(); store?.close();
    inbox.close();
    releaseLock();
    process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(JSON.stringify({ event: 'bridge-start-failed', code: codeOf(e) })); process.exitCode = 1; });
}
