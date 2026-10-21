import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
export function numericId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new Error('invalid-numeric-id');
  return value;
}
export function parseMessage(line) {
  return JSON.parse(line, (key, value, context) => {
    if (['log_id', 'chat_id', 'sender_id'].includes(key)) return numericId(typeof value === 'number' ? context.source : value);
    return value;
  });
}

export class KakaoSource {
  constructor(bin, rooms, selfId) {
    this.bin = bin;
    this.rooms = rooms.map(numericId);
    this.selfId = numericId(selfId);
  }
  checkRoom(roomId) {
    numericId(roomId);
    if (!this.rooms.includes(roomId)) throw new Error('room-denied');
  }
  async query(sql) {
    try {
      const { stdout } = await exec(this.bin, ['query', sql], { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch { throw new Error('kakao-db-unavailable'); }
  }
  async latest(roomId, selfOnly = false) {
    this.checkRoom(roomId);
    const rows = await this.query(`SELECT CAST(COALESCE(MAX(logId),0) AS TEXT) FROM NTChatMessage WHERE chatId=${roomId}${selfOnly ? ` AND authorId=${this.selfId}` : ''}`);
    return rows[0][0];
  }
  async poll(roomId, cursor) {
    this.checkRoom(roomId);
    if (cursor !== '0') numericId(cursor);
    const rows = await this.query(`SELECT CAST(logId AS TEXT), CAST(chatId AS TEXT), CAST(authorId AS TEXT), type, message FROM NTChatMessage WHERE chatId=${roomId} AND logId>${cursor} AND authorId<>${this.selfId} ORDER BY logId ASC LIMIT 50`);
    return rows.map(([id, roomId, senderId, messageType, text]) => ({
      id: numericId(id), roomId: numericId(roomId), senderId: numericId(senderId), messageType, text: text ?? '',
    }));
  }
  async photo(event) {
    this.checkRoom(event.roomId);
    numericId(event.id); numericId(event.senderId);
    const rows = await this.query(`SELECT type, attachment, supplement, extra, localFilePath FROM NTChatMessage WHERE chatId=${event.roomId} AND logId=${event.id} AND authorId=${event.senderId} AND authorId<>${this.selfId} LIMIT 7`);
    return rows.map(([messageType, attachment, supplement, extra, localFilePath]) => ({ messageType, attachment, supplement, extra, localFilePath }));
  }
  async assertPolicy() {
    let p;
    try {
      p = JSON.parse(await readFile(path.join(os.homedir(), '.kakaocli/policy.json'), 'utf8'),
        (key, value, ctx) => ['chatId', 'primaryChatId', 'expectedUserId'].includes(key) && typeof value === 'number' ? ctx.source : value);
    } catch { throw new Error('send-policy-unavailable'); }
    if (p.strictMode !== true || p.denyByDefault !== true || !Array.isArray(p.allowlist)
      || p.allowlist.length !== this.rooms.length || this.rooms.some(id => !p.allowlist.some(e => String(e.chatId) === id && e.expectedName?.trim()))) throw new Error('send-policy-mismatch');
  }
  async send(event, reply) {
    this.checkRoom(event.roomId);
    if (typeof reply !== 'string' || !reply.trim() || reply.length > 10000) throw new Error('invalid-reply');
    await this.assertPolicy();
    const before = await this.latest(event.roomId, true);
    try { await exec(this.bin, ['send', event.roomId, reply], { timeout: 60_000, maxBuffer: 1024 * 1024 }); }
    catch { throw new Error('send-uncertain'); }
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await this.query(`SELECT message FROM NTChatMessage WHERE chatId=${event.roomId} AND authorId=${this.selfId} AND logId>${before} ORDER BY logId ASC LIMIT 20`);
      if (rows.some(r => r[0] === reply)) return;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('send-uncertain');
  }
}
