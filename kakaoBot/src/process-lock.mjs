import { readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { BotError } from './errors.mjs';

export function acquireLock(filename) {
  const token = randomUUID();
  let db;
  const mask = process.umask(0o077);
  try {
    db = new DatabaseSync(filename + '.sqlite');
    db.exec('PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE;');
    chmodSync(filename + '.sqlite', 0o600);
  } catch {
    db?.close(); throw new BotError('bot-already-running');
  } finally { process.umask(mask); }
  try { writeFileSync(filename, JSON.stringify({ pid: process.pid, token }), { mode: 0o600 }); chmodSync(filename, 0o600); }
  catch (e) { db.close(); throw e; }
  return () => {
    try { if (JSON.parse(readFileSync(filename, 'utf8')).token === token) unlinkSync(filename); } catch {}
    db.close();
  }
}
