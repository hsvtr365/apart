import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink, rm, mkdir, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Inbox, deliverOne, parseMessage } from '../src/mac-bridge.mjs';
import { KakaoSource, numericId } from '../src/mac-source.mjs';
import { originalURL, isPublicAddress, readLocalOriginal, resolvePhotos, inspectImage, MAX_IMAGE, MAX_TOTAL } from '../src/mac-media.mjs';

const room = '18497328562223036', sender = '6101118734436341752', id = '3956165960946077697';
const event = { id, roomId: room, senderId: sender, messageType: 1, text: '@뽀롱봇 중계 수신 테스트' };
const source = { rooms: [room], selfId: '162909104' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
const url = 'https://talk.kakaocdn.net/dna/one/two/signed/photo.png?credential=c&expires=123&signature=s';
const photo = (overrides = {}) => ({ messageType: 2, localFilePath: '', attachment: JSON.stringify({
  mt: 'image/png', s: png.length, w: 1, h: 1, k: 'one/two/resource/photo.png', url, ...overrides,
}) });

test('Int64 IDs stay exact and quoted user text is unchanged', () => {
  const text = 'literal "chat_id":18497328562223036';
  const raw = `{"log_id":${id},"chat_id":${room},"sender_id":${sender},"text":${JSON.stringify(text)}}`;
  assert.deepEqual(parseMessage(raw), { log_id: id, chat_id: room, sender_id: sender, text });
  for (const bad of ['1 OR 1=1', '-1', '1e3', '9223372036854775808', '0']) assert.throws(() => numericId(bad));
});

test('DB queries are room-scoped, self-excluding and return string IDs', async () => {
  const s = new KakaoSource('/unused', [room], source.selfId);
  let sql;
  s.query = async q => { sql = q; return [[id, room, sender, 1, event.text]]; };
  assert.deepEqual(await s.poll(room, '0'), [event]);
  assert.ok(sql.includes(`chatId=${room}`) && sql.includes(`authorId<>${source.selfId}`));
  assert.ok(sql.includes('CAST(logId AS TEXT)'));
  await assert.rejects(s.poll('123', '0'), /room-denied/);
  await assert.rejects(s.poll(room, '0 OR 1=1'), /invalid-numeric-id/);
});

test('deduplication, durable uncertainty, and payload scrubbing prevent repeat sends', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mac-inbox-test-'));
  const filename = path.join(dir, 'inbox.sqlite');
  let inbox = new Inbox(filename), sent = 0, posts = 0;
  try {
    inbox.accept(room, [event, event]);
    await assert.rejects(deliverOne({ inbox, source, processEvent: async () => { posts++; return { reply: 'test reply' }; },
      send: async () => { sent++; throw new Error('send-uncertain'); } }), /send-uncertain/);
    assert.deepEqual(inbox.counts().map(r => ({ ...r })), [{ status: 'uncertain', count: 1 }]);
    assert.equal(inbox.db.prepare('SELECT payload FROM inbox').get().payload, '{}');
    inbox.close(); inbox = new Inbox(filename);
    inbox.accept(room, [event]);
    assert.equal(await deliverOne({ inbox, source, processEvent: async () => { posts++; return { reply: 'duplicate' }; } }), false);
    assert.equal(sent, 1); assert.equal(posts, 1);
    assert.equal(inbox.cursor(room), id);
  } finally { inbox.close(); await rm(dir, { recursive: true, force: true }); }
});

test('processor failure stays pending; ignored/null and own/off-room events never send', async () => {
  for (const raw of [event, { ...event, senderId: source.selfId }, { ...event, roomId: '123' }]) {
    const inbox = new Inbox(':memory:');
    try {
      inbox.accept(raw.roomId, [raw]);
      let posts = 0, sends = 0;
      const post = async () => { posts++; throw new Error('processing-unavailable'); };
      const send = async () => sends++;
      if (raw === event) {
        await assert.rejects(deliverOne({ inbox, source, processEvent: post, send }), /processing-unavailable/);
        assert.ok(inbox.pending());
        await deliverOne({ inbox, source, processEvent: async () => ({ ignored: true, reply: 'must not send' }), send });
      } else await deliverOne({ inbox, source, processEvent: post, send });
      assert.equal(sends, 0); assert.equal(posts, raw === event ? 1 : 0);
    } finally { inbox.close(); }
  }
  for (const result of [{ reply: null }, { ignored: true }, { reply: '' }]) {
    const inbox = new Inbox(':memory:');
    try { inbox.accept(room, [event]); await deliverOne({ inbox, source, processEvent: async () => result, send: async () => assert.fail('unexpected send') }); }
    finally { inbox.close(); }
  }
});

test('concurrent delivery workers cannot send the same event twice', async () => {
  const inbox = new Inbox(':memory:');
  inbox.accept(room, [event]);
  let sends = 0;
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  let posts = 0;
  const post = async () => { if (++posts === 2) release(); await barrier; return { reply: 'once' }; };
  try {
    await Promise.all([1, 2].map(() => deliverOne({ inbox, source, processEvent: post, send: async () => { sends++; } })));
    assert.equal(sends, 1);
  } finally { inbox.close(); }
});

test('direct engine callback receives string IDs and original Base64 without an HTTP hop', async () => {
  const inbox = new Inbox(':memory:');
  inbox.accept(room, [{ ...event, messageType: 2 }]);
  let received, sends = 0;
  try {
    await deliverOne({ inbox, source: { ...source, photo: async () => [photo()] },
      media: rows => resolvePhotos(rows, { download: async () => png }),
      processEvent: async payload => { received = payload; return { reply: 'test reply' }; },
      send: async (e, reply) => { sends++; assert.equal(e.roomId, room); assert.equal(reply, 'test reply'); } });
    assert.deepEqual(received, { id, roomId: room, senderId: sender, text: event.text,
      images: [{ mime: 'image/png', base64: png.toString('base64') }] });
    assert.equal(sends, 1); assert.equal(inbox.pending(), undefined);
  } finally { inbox.close(); }
});

test('only validated original Kakao CDN URLs and public DNS answers are eligible', () => {
  assert.equal(originalURL(url).hostname, 'talk.kakaocdn.net');
  for (const bad of ['file:///etc/passwd', url.replace('https:', 'http:'), url.replace('talk.kakaocdn.net', 'evil.test'),
    url.replace('/dna/', '/anything/'), url + '&convert=resize', url + '&signature=again', url.replace('https://', 'https://user:pass@')]) assert.throws(() => originalURL(bad));
  for (const addr of ['127.0.0.1', '10.0.0.1', '100.92.167.33', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1']) assert.equal(isPublicAddress(addr), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});

test('original bytes match metadata and limits; invalid photos never reach the engine', async () => {
  assert.deepEqual(inspectImage(png), { mime: 'image/png', width: 1, height: 1, bytes: png.length });
  const options = { download: async () => png };
  const result = await resolvePhotos([photo()], options);
  assert.equal(result.images[0].base64, png.toString('base64'));
  await assert.rejects(resolvePhotos([photo({ w: 2 })], options), /media-original-mismatch/);
  await assert.rejects(resolvePhotos([photo({ s: MAX_IMAGE + 1 })], options), /media-metadata-invalid/);
  await assert.rejects(resolvePhotos(Array(7).fill(photo()), options), /media-count-invalid/);
  await assert.rejects(resolvePhotos([photo({ url: 'https://evil.test/x' })], options), /media-url-denied/);
  await assert.rejects(resolvePhotos([photo({ k: 'other/room/resource/photo.png' })], options), /media-resource-mismatch/);
  assert.throws(() => inspectImage(Buffer.from('not an image')), /media-format-invalid/);
  const largeMeta = Array(3).fill(photo({ s: MAX_TOTAL / 2 }));
  await assert.rejects(resolvePhotos(largeMeta, { download: async () => assert.fail('oversized set fetched') }), /media-total-too-large/);
  const inbox = new Inbox(':memory:');
  try {
    inbox.accept(room, [{ ...event, messageType: 2 }]);
    await assert.rejects(deliverOne({ inbox, source: { ...source, photo: async () => [photo({ w: 2 })] },
      media: rows => resolvePhotos(rows, options), processEvent: async () => assert.fail('invalid media posted') }), /media-original-mismatch/);
    assert.equal(inbox.pending(), undefined);
  } finally { inbox.close(); }
});

test('local image paths cannot escape approved roots or follow symlinks', async () => {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'mac-media-test-')));
  try {
    const root = path.join(dir, 'allowed'); await mkdir(root);
    const file = path.join(root, 'photo.png'); await writeFile(file, png);
    assert.deepEqual(await readLocalOriginal(file, [root], png.length), png);
    const outside = path.join(dir, 'outside.png'); await writeFile(outside, png);
    const link = path.join(root, 'link.png'); await symlink(outside, link);
    await assert.rejects(readLocalOriginal(outside, [root], png.length), /media-path-denied/);
    await assert.rejects(readLocalOriginal(link, [root], png.length), /media-path-denied/);
    await assert.rejects(readLocalOriginal(file, [root], png.length - 1), /media-local-size-invalid/);
    await assert.rejects(readLocalOriginal('file://' + file, [root], png.length), /media-path-denied/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('own-account receive mode admits tagged commands and photos but excludes reply echoes', async () => {
  const ownSource = new KakaoSource('/unused', [room], source.selfId, { allowSelfCommands: true });
  let sql;
  ownSource.query = async q => { sql = q; return [[id, room, source.selfId, 1, '@뽀롱봇 질문']]; };
  await ownSource.poll(room, '0');
  assert.ok(!sql.includes('authorId<>'));
  for (const [messageType, text, expected] of [[1, '@뽀롱봇 질문', 1], [1, '일반 대화', 0],
    [1, '[뽀롱봇]\n@뽀롱봇 질문을 보내세요', 0], [1, '@뽀롱봇아 질문', 0], [2, '', 1]]) {
    const inbox = new Inbox(':memory:');
    let processed = 0;
    try {
      inbox.accept(room, [{ ...event, senderId: source.selfId, messageType, text }]);
      await deliverOne({ inbox, source: { ...ownSource, photo: async () => [] }, media: async () => ({ images: [] }),
        processEvent: async () => { processed++; return { ignored: true }; }, send: async () => assert.fail('unexpected send') });
      assert.equal(processed, expected);
    } finally { inbox.close(); }
  }
});
