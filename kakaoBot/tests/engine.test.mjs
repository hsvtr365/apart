import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, validateEvent } from '../src/engine.mjs';
import { authorized } from '../src/http.mjs';

const photo = { mime: 'image/png', base64: Buffer.from('test image').toString('base64') };
function setup() {
  const saved = new Map(), operations = new Map(), publications = [], searches = [];
  let time = Date.parse('2026-10-21T01:00:00Z'), questions = [];
  const engine = createEngine({
    env: { ALLOWED_ROOM_IDS: 'test', BOT_SENDER_ID: 'bot', BOT_NAME: '마을봇', APP_PUBLIC_URL: 'https://example.com' },
    store: { get: k => saved.get(k), put: (k, v) => saved.set(k, v),
      pending: user => [...operations.values()].find(o => o.userKey === user && o.status === 'pending'), operation: key => operations.get(key),
      begin: op => { const value = { ...op, created: time, status: 'pending' }; operations.set(op.eventKey, value); return value; },
      complete: (requestKey, result) => { const op = [...operations.values()].find(o => o.requestKey === requestKey); op.status = 'done'; op.result = result; } }, now: () => time,
    ai: { describe: async i => i.base64, draft: async data => ({ question: questions.shift() ?? null, post: { title: '공고', body: '테스트 공고입니다.', category: 'NOTICE', scheduleType: 'WEEKLY', noticeStartDate: '2026-10-21', noticeEndDate: '2026-10-30' } }),
      search: async () => ({ query: '', category: 'FOOD', date: '2026-10-21' }), answer: async () => '방문 예정입니다.' },
    app: { publish: async (...args) => { publications.push(args); return { id: 'post1' }; },
      search: async input => { searches.push(input); return { today: '2026-10-21', posts: [{ id: 'post2', title: '먹거리', body: '방문 예정', category: 'FOOD', scheduleType: 'ONCE', startDate: '2026-10-21' }], truncated: false }; } },
  });
  let id = 0;
  return { engine, publications, searches, ask: q => questions.push(q), advance: ms => { time += ms; },
    event: (text, extra = {}) => ({ id: String(++id), roomId: 'test', senderId: 'alice', text, ...extra }) };
}
test('authorization and image input fail closed', () => {
  assert(!authorized('Bearer short', 'short'));
  assert(authorized('Bearer ' + 'a'.repeat(32), 'a'.repeat(32)));
  assert.throws(() => validateEvent({ id: 10, roomId: 'test', senderId: 'alice', text: '' }));
  assert.throws(() => validateEvent({ id: '1', roomId: 'test', senderId: 'alice', text: '', images: [{ mime: 'image/svg+xml', base64: 'AAAA' }] }));
});
test('unlisted rooms and self messages never call AI or publish', async () => {
  const t = setup();
  assert.deepEqual(await t.engine.process(t.event('@마을봇 등록', { roomId: 'private' })), { ignored: true });
  assert.deepEqual(await t.engine.process(t.event('@마을봇 등록', { senderId: 'bot' })), { ignored: true });
  assert.equal(t.publications.length, 0);
});
test('photos only bind to the same room and sender; duplicate event publishes once', async () => {
  const t = setup();
  await t.engine.process(t.event('', { images: [photo] }));
  const other = await t.engine.process(t.event('@마을봇 등록', { senderId: 'bob' }));
  assert.match(other.reply, /사진/);
  const event = t.event('@마을봇 등록');
  const first = await t.engine.process(event);
  assert.match(first.reply, /post1/);
  assert.deepEqual(await t.engine.process(event), first);
  assert.equal(t.publications.length, 1);
});
test('missing fields ask a question and keep publication key stable', async () => {
  const t = setup();
  t.ask('공고 종료일은 언제인가요?');
  assert.match((await t.engine.process(t.event('@마을봇 등록', { images: [photo] }))).reply, /종료일/);
  assert.equal(t.publications.length, 0);
  await t.engine.process(t.event('@마을봇 종료일은 2026-10-30'));
  assert.equal(t.publications.length, 1);
});
test('expired photo and canceled session cannot leak into a new request', async () => {
  const t = setup();
  await t.engine.process(t.event('', { images: [photo] }));
  t.advance(301_000);
  assert.match((await t.engine.process(t.event('@마을봇 등록'))).reply, /사진/);
  await t.engine.process(t.event('@마을봇 취소'));
  t.advance(61_000);
  assert.match((await t.engine.process(t.event('@마을봇 등록'))).reply, /사진/);
  assert.equal(t.publications.length, 0);
});
test('query answers include application-built evidence links', async () => {
  const t = setup();
  const result = await t.engine.process(t.event('@마을봇 오늘 먹거리 있어?'));
  assert.match(result.reply, /https:\/\/example.com\/post\/post2/);
  assert.equal(t.searches.length, 1);
});
