import path from 'node:path';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const dir = path.resolve(process.env.MAC_STATE_DIR || './data/mac');
for (const [name, filename, table] of [['inbox', 'mac-inbox.sqlite', 'inbox'], ['publications', 'engine/events.sqlite', 'publications']]) {
  const file = path.join(dir, filename);
  if (!existsSync(file)) { console.log(JSON.stringify({ name, counts: [] })); continue; }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    console.log(JSON.stringify({ name, counts: db.prepare(`SELECT status,COUNT(*) AS count FROM ${table} GROUP BY status`).all() }));
    if (table === 'inbox') console.log(JSON.stringify({ name, attention: db.prepare("SELECT id,status FROM inbox WHERE status IN ('uncertain','blocked') LIMIT 20").all() }));
    else console.log(JSON.stringify({ name, pending: db.prepare("SELECT requestKey,status,created FROM publications WHERE status='pending' LIMIT 10").all() }));
  } finally { db.close(); }
}
