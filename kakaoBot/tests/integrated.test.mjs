import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEngine, normalizePost, registrationIntent, validateEvent } from '../src/engine.mjs';
import { openStore } from '../src/store.mjs';
import { createAI } from '../src/ai.mjs';
import { createApp, publicResults } from '../src/app.mjs';
import { BotError } from '../src/errors.mjs';
import { Inbox, deliverOne } from '../src/mac-bridge.mjs';
import { acquireLock } from '../src/process-lock.mjs';

const photo = { mime: 'image/png', base64: Buffer.from('test').toString('base64') };
const post = { title: '점검 공고', body: '시설 점검 안내', category: 'NOTICE', scheduleType: 'WEEKLY',
  noticeStartDate: '2026-10-21', noticeEndDate: '2026-10-30' };
const env = { ALLOWED_ROOM_IDS: 'room,room2', BOT_SENDER_ID: 'bot', BOT_NAME: '마을봇', APP_PUBLIC_URL: 'https://apart.jujeop.com' };
const event = (id, text, extra = {}) => ({ id, roomId: 'room', senderId: 'alice', text, ...extra });
function setup(overrides = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mac-bot-'));
  const store = openStore(dir), calls = { describe: 0, publish: 0, search: 0 };
  let time = Date.now();
  const ai = { describe: async () => { calls.describe++; return { text: '점검 공고' }; }, draft: async () => ({ post }),
    search: async () => ({ query: '', category: 'FOOD', date: '2026-10-21' }), answer: async () => '예정된 방문 정보입니다.', ...overrides.ai };
  const app = { publish: async () => { calls.publish++; return { id: 'created1' }; },
    search: async () => { calls.search++; return { today: '2026-10-21', posts: [], truncated: false }; }, ...overrides.app };
  let engine = createEngine({ env, ai, app, store, now: () => time });
  return { dir, store, ai, app, calls, get engine() { return engine; }, advance: n => { time += n; },
    restart: () => { engine.close(); engine = createEngine({ env, ai, app, store, now: () => time }); },
    close: () => { engine.close(); store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

test('Gemma is the only AI endpoint; image bytes are sent in Ollama images', async () => {
  const requests = [];
  const ai = createAI({ GEMMA_BASE_URL: 'https://gitlab.swempire.co.kr/ollama/', GEMMA_MODEL: 'gemma4:26b', QWEN_BASE_URL: 'https://must-not-call.invalid' }, {
    request: async (url, init) => { requests.push({ url: url.href, body: JSON.parse(init.body) }); return { message: { content: '이미지 설명' } }; },
  });
  assert.deepEqual(await ai.describe(photo), { text: '이미지 설명' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://gitlab.swempire.co.kr/ollama/api/chat');
  assert.equal(requests[0].body.model, 'gemma4:26b');
  assert.deepEqual(requests[0].body.messages[1].images, [photo.base64]);
  assert.ok(!requests[0].body.messages[1].content.includes(photo.base64));
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try { process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; assert.throws(() => createAI({}), /ai-tls-required/); }
  finally { if (previous === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous; }
});

test('photos alone, negated registration, and other rooms/users do not publish or call vision', async () => {
  const t = setup();
  try {
    await t.engine.process(event('1', '', { images: [photo] }));
    assert.equal(t.calls.describe, 0); assert.equal(t.calls.publish, 0);
    assert.match((await t.engine.process(event('2', '@마을봇 등록', { senderId: 'bob' }))).reply, /사진/);
    assert.match((await t.engine.process(event('3', '@마을봇 등록', { roomId: 'room2' }))).reply, /사진/);
    await t.engine.process(event('4', '@마을봇 등록하지 마'));
    assert.equal(t.calls.publish, 0);
    assert.equal(registrationIntent('등록된 공고 있어?'), false);
    assert.equal(registrationIntent('이 공고 등록해줘'), true);
  } finally { t.close(); }
});

test('missing and conflicting dates require clarification before any publication', async () => {
  for (const raw of [{ ...post, noticeEndDate: null }, { ...post, noticeEndDate: '2026-10-20' }, { ...post, noticeEndDate: '2026-02-30' }]) {
    const t = setup({ ai: { draft: async () => ({ post: raw }) } });
    try {
      assert.ok(normalizePost(raw).question);
      assert.match((await t.engine.process(event('1', '@마을봇 이 공고 등록해줘', { images: [photo] }))).reply, /날짜|기간|종료일|시작일/);
      assert.equal(t.calls.publish, 0);
    } finally { t.close(); }
  }
});

test('expiry, cancellation and restart discard ordinary in-memory photos', async () => {
  for (const action of ['expire', 'cancel', 'restart']) {
    const t = setup();
    try {
      await t.engine.process(event('1', '', { images: [photo] }));
      if (action === 'expire') t.advance(601000);
      if (action === 'cancel') await t.engine.process(event('2', '@마을봇 취소'));
      if (action === 'restart') t.restart();
      assert.match((await t.engine.process(event('3', '@마을봇 등록'))).reply, /사진/);
      assert.equal(t.calls.publish, 0);
    } finally { t.close(); }
  }
});

test('AI outage returns a safe reply without publishing; duplicate and simultaneous requests are cached', async () => {
  const t = setup({ ai: { describe: async () => { throw new BotError('ai-unavailable'); } } });
  try {
    const e = event('1', '@마을봇 등록', { images: [photo] });
    const [a, b] = await Promise.all([t.engine.process(e), t.engine.process(e)]);
    assert.deepEqual(a, b); assert.equal(a.code, 'ai-unavailable'); assert.equal(t.calls.publish, 0);
    assert.deepEqual(await t.engine.process(e), a);
  } finally { t.close(); }
});

test('a lost site response and full restart reuse exactly the same durable publication intent', async () => {
  const remote = new Map(), keys = [];
  let creates = 0, first = true;
  const t = setup({ app: { publish: async (key, draft, images) => {
    keys.push(key);
    if (!remote.has(key)) { creates++; remote.set(key, { id: 'durablePost' }); }
    if (first) { first = false; throw new BotError('app-unavailable'); }
    return remote.get(key);
  } } });
  let replacement;
  try {
    const response = await t.engine.process(event('1', '@마을봇 등록', { images: [photo] }));
    assert.match(response.reply, /아직 확인|재시도/);
    t.engine.close(); t.store.close();
    replacement = openStore(t.dir);
    const restarted = createEngine({ env, ai: t.ai, app: t.app, store: replacement });
    assert.match((await restarted.process(event('2', '@마을봇 재시도'))).reply, /durablePost/);
    assert.equal(creates, 1); assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
    assert.deepEqual(replacement.operation(keys[0])?.payload ?? {}, {});
    assert.equal(statSync(path.join(t.dir, 'events.sqlite')).mode & 0o777, 0o600);
    restarted.close();
  } finally {
    replacement?.close(); rmSync(t.dir, { recursive: true, force: true });
  }
});

test('successful registration followed by uncertain Kakao send never republishes', async () => {
  const t = setup(), inbox = new Inbox(':memory:');
  const raw = { id: '1', roomId: 'room', senderId: 'alice', messageType: 1, text: '@마을봇 등록' };
  try {
    await t.engine.process(event('photo', '', { images: [photo] }));
    inbox.accept('room', [raw]);
    await assert.rejects(deliverOne({ inbox, source: { rooms: ['room'], selfId: 'bot' }, processEvent: e => t.engine.process(e),
      send: async () => { throw new Error('send-uncertain'); } }), /send-uncertain/);
    inbox.accept('room', [raw]);
    assert.equal(await deliverOne({ inbox, source: { rooms: ['room'], selfId: 'bot' }, processEvent: () => assert.fail('reprocessed') }), false);
    assert.match((await t.engine.process(event('1', '@마을봇 등록'))).reply, /created1/);
    assert.equal(t.calls.publish, 1);
  } finally { inbox.close(); t.close(); }
});

test('duplicate photos require the same sender explicit confirmation and a distinct idempotency key', async () => {
  const keys = [], forced = [];
  const t = setup({ app: { publish: async (key, post, images, force) => {
    keys.push(key); forced.push(force); return force ? { id: 'newPost' } : { id: 'existing', candidate: true };
  } } });
  try {
    assert.match((await t.engine.process(event('1', '@마을봇 등록', { images: [photo] }))).reply, /existing/);
    assert.match((await t.engine.process(event('2', '@마을봇 중복이어도 등록', { senderId: 'bob' }))).reply, /요청이 없습니다/);
    assert.match((await t.engine.process(event('3', '@마을봇 중복이어도 등록'))).reply, /newPost/);
    assert.deepEqual(forced, [false, true]); assert.notEqual(keys[0], keys[1]);
  } finally { t.close(); }
});

test('hidden/deleted posts and private fields never reach the AI answer or Kakao links', async () => {
  let evidence;
  const t = setup({ app: { search: async () => ({ today: '2026-10-21', truncated: true, posts: [
    { id: 'hidden', title: '숨김', body: 'secret', hidden: true },
    { id: 'deleted', title: '삭제', body: 'secret', userDeleted: true },
    { id: 'public', title: '먹거리', body: '예정', category: 'FOOD', scheduleType: 'ONCE', startDate: '2026-10-21', authorId: 'private', email: 'private@example.com' },
  ] }) }, ai: { answer: async data => { evidence = data; return '일정상 예정입니다.'; } } });
  try {
    const result = await t.engine.process(event('1', '@마을봇 오늘 먹거리 있어?'));
    assert.deepEqual(evidence.posts.map(p => p.id), ['public']);
    assert.equal(evidence.posts[0].email, undefined); assert.equal(evidence.posts[0].authorId, undefined);
    assert.match(result.reply, /예정/); assert.match(result.reply, /현장 제보: 확인된 자료 없음/);
    assert.match(result.reply, /post\/public/); assert.doesNotMatch(result.reply, /post\/hidden|post\/deleted/);
  } finally { t.close(); }
});

test('site API uses only loopback 28006 and the exact JSON/multipart contracts', async () => {
  const calls = [];
  const app = createApp({ APP_BOT_SECRET: 's'.repeat(40) }, { request: async (url, init) => {
    calls.push({ url: url.href, init });
    return new Response(JSON.stringify(init.headers['Content-Type'] ? { today: '2026-10-21', posts: [], truncated: false } : { id: 'created' }));
  } });
  await app.search({ query: '', category: 'FOOD', date: '2026-10-21', sql: 'not forwarded' });
  await app.publish('a'.repeat(64), post, [photo], true);
  assert.equal(calls[0].url, 'http://127.0.0.1:28006/api/internal/bot');
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: '', category: 'FOOD', date: '2026-10-21' });
  assert.equal(calls[1].init.body.get('requestKey'), 'a'.repeat(64));
  assert.equal(calls[1].init.body.get('forceDuplicate'), 'true');
  assert.equal(calls[1].init.body.getAll('files').length, 1);
  assert.throws(() => createApp({ APP_INTERNAL_URL: 'https://apart.jujeop.com/api/internal/bot' }), /app-url-invalid/);
  await assert.rejects(createApp({}).search({ query: '', category: null, date: null }), /app-not-configured/);
  await assert.rejects(createApp({ APP_BOT_SECRET: 's'.repeat(40) }, { request: async () => { throw new Error('private secret error'); } }).search({ query: '', category: null, date: null }), /app-unavailable/);
});

test('process lock prevents two programs sharing a state directory', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bot-lock-'));
  try { const filename = path.join(dir, 'bot.lock'), release = acquireLock(filename);
    assert.throws(() => acquireLock(filename), /bot-already-running/); release(); acquireLock(filename)();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
