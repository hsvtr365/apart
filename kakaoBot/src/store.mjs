import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import path from 'node:path';

export function openStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 }); chmodSync(dir, 0o700);
  const filename = path.join(dir, 'events.sqlite');
  const mask = process.umask(0o077);
  let db;
  try { db = new DatabaseSync(filename); } finally { process.umask(mask); }
  chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS replies (key TEXT PRIMARY KEY, reply TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS publications (requestKey TEXT PRIMARY KEY, userKey TEXT NOT NULL, eventKey TEXT NOT NULL,
      payload TEXT NOT NULL, result TEXT, status TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS publication_user ON publications(userKey,status);
    CREATE UNIQUE INDEX IF NOT EXISTS publication_event ON publications(eventKey);`);
  const decode = row => row ? { ...row, payload: JSON.parse(row.payload), result: row.result ? JSON.parse(row.result) : null } : undefined;
  return {
    get(key) { const row = db.prepare('SELECT reply FROM replies WHERE key=?').get(key); return row ? JSON.parse(row.reply) : undefined; },
    put(key, reply) { db.prepare('INSERT OR REPLACE INTO replies VALUES (?,?,?)').run(key, JSON.stringify(reply), Date.now()); },
    pending(userKey) { return decode(db.prepare("SELECT * FROM publications WHERE userKey=? AND status='pending' ORDER BY created LIMIT 1").get(userKey)); },
    operation(eventKey) { return decode(db.prepare('SELECT * FROM publications WHERE eventKey=?').get(eventKey)); },
    begin(op) {
      if (db.prepare("SELECT COUNT(*) AS n FROM publications WHERE status='pending'").get().n >= 10) throw new Error('publication-capacity');
      db.prepare("INSERT INTO publications VALUES(?,?,?,?,NULL,'pending',?)").run(op.requestKey, op.userKey, op.eventKey, JSON.stringify(op.payload), Date.now());
      return decode(db.prepare('SELECT * FROM publications WHERE requestKey=?').get(op.requestKey));
    },
    complete(requestKey, result) { db.prepare("UPDATE publications SET status='done',payload='{}',result=? WHERE requestKey=?").run(JSON.stringify(result), requestKey); },
    counts() { return db.prepare('SELECT status,COUNT(*) AS count FROM publications GROUP BY status').all(); },
    close: () => db.close(),
  };
}
