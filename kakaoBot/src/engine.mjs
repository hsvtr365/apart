import { isLongNotice } from './notice-kind.mjs';
import { filterNotices, noticeScope } from './notices.mjs';
import { allowOwnEvent } from './self-commands.mjs';
import { createHash } from 'node:crypto';
import { BotError } from './errors.mjs';
import { publicResults, searchInput } from './app.mjs';

export const keyOf = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validateEvent(e) {
  if (!e || ['id', 'roomId', 'senderId'].some(k => typeof e[k] !== 'string' || !e[k] || e[k].length > 200)
    || typeof e.text !== 'string' || e.text.length > 3000) throw new BotError('invalid-event');
  if (e.images !== undefined && (!Array.isArray(e.images) || e.images.length > 6)) throw new BotError('invalid-images');
  let total = 0;
  for (const image of e.images ?? []) {
    if (!image || !['image/jpeg', 'image/png', 'image/webp'].includes(image.mime)
      || typeof image.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.base64)
      || !image.base64.length || image.base64.length > 11_184_812) throw new BotError('invalid-image');
    const size = Buffer.from(image.base64, 'base64').length;
    if (size > 8 * 1024 * 1024 || (total += size) > 16 * 1024 * 1024) throw new BotError('invalid-image');
  }
  return e;
}
export function normalizePost(raw) {
  if (!raw || typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 15
    || typeof raw.body !== 'string' || !raw.body.trim() || raw.body.length > 500
    || !['FOOD', 'NOTICE', 'MARKET'].includes(raw.category) || !['ONCE', 'WEEKLY'].includes(raw.scheduleType)) return { question: '제목·내용·게시물 종류와 반복 여부를 확인해주세요.' };
  const p = Object.fromEntries(['title', 'body', 'category', 'scheduleType'].map(k => [k, raw[k]]));
  for (const key of ['startDate', 'finishDate', 'noticeStartDate', 'noticeEndDate']) {
    p[key] = raw[key] ?? null;
    if (p[key] !== null && !day(p[key])) return { question: '연도를 포함한 정확한 날짜를 알려주세요.' };
  }
  for (const key of ['arrivalTime', 'departureTime']) {
    p[key] = raw[key] ?? null;
    if (p[key] !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p[key])) return { question: '정확한 시작·종료 시각을 알려주세요.' };
  }
  p.weekdays = raw.weekdays ?? []; p.seasons = raw.seasons ?? [];
  if (!Array.isArray(p.weekdays) || p.weekdays.length > 7 || p.weekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6)
    || !Array.isArray(p.seasons) || p.seasons.length > 4 || p.seasons.some(s => !['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'].includes(s))) return { question: '반복 요일이나 계절을 확인해주세요.' };
  p.weekdays = [...new Set(p.weekdays)].sort(); p.seasons = [...new Set(p.seasons)];
  if (p.category === 'NOTICE') {
    if (!p.noticeStartDate || !p.noticeEndDate) return { question: '공고를 게시할 시작일과 종료일을 연도와 함께 알려주세요.' };
    if (p.noticeEndDate < p.noticeStartDate) return { question: '공고 종료일이 시작일보다 빠릅니다. 올바른 게시 기간을 알려주세요.' };
    p.noticeKind = isLongNotice(p.noticeStartDate, p.noticeEndDate) || raw.noticeKind === "ROUTINE" ? "ROUTINE" : "SHORT";
    Object.assign(p, { scheduleType: 'WEEKLY', startDate: null, finishDate: null, weekdays: [], seasons: [], arrivalTime: null, departureTime: null });
  } else {
    p.noticeKind = null;
    p.noticeStartDate = null; p.noticeEndDate = null;
    if (p.scheduleType === 'ONCE') {
      if (!p.startDate || (p.finishDate && p.finishDate < p.startDate)) return { question: '일정의 정확한 시작일과 종료일을 알려주세요.' };
      p.weekdays = []; p.seasons = [];
    } else {
      if (!p.weekdays.length) return { question: '매주 어느 요일에 열리는지 알려주세요.' };
      p.startDate = null; p.finishDate = null;
    }
    if (p.arrivalTime && p.departureTime && p.arrivalTime > p.departureTime) return { question: '종료 시각이 시작보다 빠릅니다. 자정을 넘기는 일정인지 알려주세요.' };
  }
  return { post: { ...p, mapX: null, mapY: null, latitude: null, longitude: null, imageUrl: null } };
}
export function registrationIntent(text) {
  const compact = text.replace(/\s+/g, '').replace(/[.!?。！？~]+$/g, '');
  if (/(?:등록|저장|업로드|게시|올리)(?:하지|하지마|금지|취소)|올리지|취소/.test(compact)) return false;
  // Bare action labels are commands only when the entire phrase matches.
  if (/^(?:(?:이|해당)?(?:공고|사진|게시물)(?:을|를)?)?(?:등록|업로드)$/.test(compact)) return true;
  // Short imperative forms; informational questions remain read-only.
  if (/(?:등록|게시|업로드)해(?:요|줘|주세요|줄래|줄수있어|줄수있나요)?$/.test(compact)
    || /올려(?:요|줘|주세요|줄래|줄수있어|줄수있나요)?$/.test(compact)) return true;
  return /등록해\s*(?:줘|주세요)|등록\s*부탁|올려\s*(?:줘|주세요)|게시해\s*(?:줘|주세요)/.test(text);
}

const todayInKorea = time => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(time));
function evidence(post) {
  const planned = post.category === 'NOTICE' ? `공고 게시 기간 ${post.noticeStartDate ?? '미상'}~${post.noticeEndDate ?? '미상'}`
    : `예정 ${post.scheduleType === 'ONCE' ? post.startDate ?? '날짜 미상' : `매주 ${(post.weekdays ?? []).map(n => '월화수목금토일'[n]).join('·')}`} ${post.arrivalTime ?? '시각 미상'}`;
  const report = post.lastPresenceReport ?? (post.presence && post.observedAt ? { state: post.presence, observedAt: post.observedAt } : null);
  if (post.category === 'NOTICE') return '';
  return `${planned} / 현장 제보: ${report && ['ARRIVED', 'GONE'].includes(report.state) ? `${report.state === 'ARRIVED' ? '도착' : '철수'} (${report.observedAt})` : '확인된 자료 없음'}`;
}

export function createEngine({ env, ai, app, store, now = Date.now }) {
  const sessions = new Map(), chats = new Map(), rates = new Map(), inflight = new Map();
  const allowed = new Set((env.ALLOWED_ROOM_IDS ?? '').split(',').filter(Boolean));
  const prefix = `@${env.BOT_NAME || '뽀롱봇'}`;
  const publicURL = new URL(env.APP_PUBLIC_URL || 'https://apart.jujeop.com');
  if (publicURL.protocol !== 'https:' || publicURL.username || publicURL.password || publicURL.pathname !== '/') throw new BotError('public-url-invalid');
  const link = id => `${publicURL.origin}/post/${encodeURIComponent(id)}`;
  let tail = Promise.resolve();
  async function processOne(raw) {
    const e = validateEvent(raw);
    if (!allowed.has(e.roomId) || ((e.senderId === env.BOT_SENDER_ID || e.isFromMe) && !allowOwnEvent(e, env.ALLOW_SELF_COMMANDS === 'true', env.BOT_NAME || '뽀롱봇'))) return { ignored: true };
    const key = keyOf(e.roomId, e.senderId, e.id), user = keyOf(e.roomId, e.senderId), time = now();
    const prior = store.get(key);
    if (prior) return prior;
    const reply = (message, code) => { const result = { reply: message, ...(code ? { code } : {}) }; store.put(key, result); return result; };
    for (const [id, s] of sessions) if (time - s.at > 600_000) sessions.delete(id);
    for (const [id, c] of chats) if (time - c.at > 600_000) chats.delete(id);
    for (const [id, r] of rates) if (time - r.at > 60_000) rates.delete(id);
    let state = sessions.get(user);
    const trimmed = e.text.trim(), called = trimmed.startsWith(prefix) && (!trimmed[prefix.length] || /\s/.test(trimmed[prefix.length]));
    const text = called ? trimmed.slice(prefix.length).trim() : trimmed;
    const pending = store.pending(user);
    const ask = question => {
      const clean = question.replace(/\((?:noticeStartDate|noticeEndDate|startDate|finishDate|arrivalTime|departureTime)\)/g, '')
        .replace(/noticeStartDate/g, '공고 게시 시작일').replace(/noticeEndDate/g, '공고 게시 종료일')
        .replace(/startDate/g, '일정 시작일').replace(/finishDate/g, '일정 종료일');
      return reply(`${clean.slice(0, 850)}\n보완 답변은 ${prefix}으로 불러주세요.`);
    };
    async function publish(op) {
      const { post, images, forceDuplicate } = op.payload;
      const result = await app.publish(op.requestKey, post, images, forceDuplicate);
      let response;
      if (result.validationError) {
        response = { reply: `등록 정보를 보완해주세요. ${String(result.validationError).slice(0, 600)}\n${prefix}으로 불러 답해주세요.` };
        if (state) state.requestKey = keyOf(op.requestKey, 'correction');
      } else if (result.candidate) {
        response = { reply: `같은 사진으로 등록된 게시물이 있습니다.\n${link(result.id)}\n별도 등록은 ${prefix} 중복이어도 등록이라고 확인해주세요.` };
        if (state) { state.candidatePayload = op.payload; state.duplicateCandidate = true; state.requestKey = keyOf(op.requestKey, 'confirmed-duplicate'); }
      } else {
        if (typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(result.id)) throw new BotError('app-response-invalid');
        response = { reply: `게시물을 등록했습니다.\n${link(result.id)}` };
        sessions.delete(user);
      }
      store.complete(op.requestKey, response);
      store.put(key, response);
      return response;
    }
    try {
      const recorded = store.operation(key);
      if (recorded?.status === 'done') { store.put(key, recorded.result); return recorded.result; }
      if (recorded?.status === 'pending') return await publish(recorded);
      if (called && (text === '취소' || /등록\s*취소|등록\s*하지|저장\s*하지/.test(text))) {
        sessions.delete(user);
        return reply(pending ? '등록 대화를 중단했습니다. 이미 전송한 요청의 처리 여부는 아직 확인되지 않았습니다. 다시 요청하면 이전 등록 건부터 확인합니다.' : '등록 요청을 취소했습니다.');
      }
      if (!called) {
        if (e.images?.length) {
          state ??= { at: time, images: [], requests: [], registering: false };
          state.images = mergeImages(state.images, e.images, sessions, user);
          state.at = time; state.photoAt = time; sessions.set(user, state);
        }
        return reply(null);
      }
      const rate = rates.get(user) ?? { at: time, count: 0 };
      if (++rate.count > 5) return reply('요청이 많습니다. 잠시 후 다시 불러주세요.');
      rates.set(user, rate);
      if (pending) {
        if (text !== '재시도') return reply(`이전 등록 요청의 처리 여부가 아직 확인되지 않았습니다. ${prefix} 재시도라고 보내면 같은 요청으로 확인·재시도합니다.`);
        if (time - pending.created > 86_400_000) return reply('오래된 등록 요청의 결과 확인이 필요합니다. 운영자에게 확인해주세요. 새 게시물은 만들지 않았습니다.');
        return await publish(pending);
      }
      const forceDuplicate = text === '중복이어도 등록';
      if (forceDuplicate && !state?.duplicateCandidate) return reply('확인 중인 중복 등록 요청이 없습니다. 사진과 등록 요청을 다시 보내주세요.');
      const registering = registrationIntent(text) || state?.registering || forceDuplicate;
      if (registering) {
        state ??= { at: time, images: [], requests: [], registering: true };
        if (!state.registering && time - (state.photoAt ?? 0) > 300_000) state.images = [];
        if (e.images?.length) state.images = mergeImages(state.images, e.images, sessions, user);
        state.registering = true; state.at = time;
        if (!state.requests.some(r => r.key === key)) state.requests.push({ key, text });
        state.requestKey ??= key;
        sessions.set(user, state);
        if (!state.images.length) return reply(`등록할 사진을 올린 뒤 ${prefix} 등록이라고 보내주세요.`);
        let post;
        if (forceDuplicate) post = state.candidatePayload.post;
        else {
          const descriptions = [];
          for (const image of state.images) descriptions.push(await ai.describe(image));
          const draft = await ai.draft({ today: todayInKorea(time), requests: state.requests.map(r => r.text), descriptions });
          if (typeof draft?.question === 'string' && draft.question.trim()) return ask(draft.question);
          const normalized = normalizePost(draft?.post);
          if (normalized.question) return ask(normalized.question);
          post = normalized.post;
        }
        app.assertReady?.();
        const op = store.begin({ requestKey: state.requestKey, userKey: user, eventKey: key,
          payload: { post, images: forceDuplicate ? state.candidatePayload.images : state.images, forceDuplicate } });
        return await publish(op);
      }
      const history = chats.get(user)?.turns ?? [];
      const route = ai.route ? await ai.route({ question: text, history }) : { kind: 'site' };
      if (!route || !['site', 'chat'].includes(route.kind)) throw new BotError('ai-response-invalid');
      if (route.kind === 'chat') {
        const response = await ai.chat({ question: text, history });
        if (typeof response !== 'string' || !response.trim()) throw new BotError('ai-response-invalid');
        const clean = response.replace(/[*_`#]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 400);
        if (!clean) throw new BotError('ai-response-invalid');
        chats.set(user, { at: time, turns: [...history, { question: text.slice(0, 500), answer: clean }].slice(-3) });
        if (chats.size > 100) chats.delete(chats.keys().next().value);
        return reply(clean);
      }
      const input = searchInput(await ai.search({ question: text, today: todayInKorea(time) }));
      const scope = noticeScope(text);
      input.noticeScope = scope.toUpperCase();
      const found = publicResults(await app.search(input));
      const beforeFilter = found.posts.length;
      found.posts = await filterNotices(found.posts, scope, ai, store);
      if (!found.posts.length) {
        if (beforeFilter || input.category === 'NOTICE') return reply(`조회 범위에 ${scope === 'routine' ? '일상' : scope === 'all' ? '' : '단기'}공고가 없습니다.${scope === 'short' ? ' 일상공고는 “일상공고 알려줘”로 볼 수 있어요.' : ''}${found.truncated ? ' 일부 자료만 조회되어 검색어를 좁혀 다시 확인해주세요.' : ''}`);
        return reply('조회 범위에서 확인할 자료가 없습니다. 검색어를 바꿔주세요.');
      }
      const posts = found.posts.slice(0, 4);
      const answer = await ai.answer({ question: text, ...found, posts });
      if (!answer || (typeof answer !== 'string' && !Array.isArray(answer.items))) throw new BotError('ai-response-invalid');
      const plain = value => String(value ?? '').replace(/https?:\/\/\S+/g, '')
        .replace(/[*_`#]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
      const lines = posts.map(p => {
        const item = answer.items?.find(i => i?.id === p.id && typeof i.summary === 'string');
        const summary = plain(item?.summary ?? p.body).slice(0, 60);
        const facts = evidence(p);
        return `${plain(p.title).slice(0, 40)}${summary ? `\n${summary}` : ''}${facts ? `\n${facts}` : ''}\n${link(p.id)}`;
      });
      return reply(lines.join('\n\n') + (found.truncated || found.posts.length > posts.length ? '\n\n일부만 표시했습니다. 검색어를 좁혀주세요.' : ''));

    } catch (error) {
      const code = error instanceof BotError ? error.code : 'processing-failed';
      if (store.pending(user)) return reply(`사이트 등록 결과를 아직 확인하지 못했습니다. ${prefix} 재시도로 같은 요청을 확인·재시도할 수 있습니다.`, code);
      if (code === 'photos-too-large') return reply('사진은 최대 6장, 장당 8MB, 합계 16MB 이내로 보내주세요.', code);
      if (code.startsWith('ai-')) return reply('사진이나 질문을 분석하지 못했습니다. 잠시 후 다시 불러주세요.', code);
      return reply('지금은 사이트에서 정보를 확인하거나 등록할 수 없습니다. 잠시 후 다시 요청해주세요.', code);
    }
  }
  function process(raw) {
    const key = keyOf(raw?.roomId, raw?.senderId, raw?.id);
    if (inflight.has(key)) return inflight.get(key);
    const task = tail.then(() => processOne(raw));
    tail = task.catch(() => {}); inflight.set(key, task);
    task.finally(() => inflight.delete(key)).catch(() => {});
    return task;
  }
  return { process, close: () => { sessions.clear(); chats.clear(); } };
}

function mergeImages(previous, added, sessions, user) {
  const unique = new Map();
  for (const image of [...previous, ...added]) unique.set(keyOf(image.mime, image.base64), image);
  const images = [...unique.values()];
  const size = list => list.reduce((n, i) => n + Buffer.from(i.base64, 'base64').length, 0);
  if (images.length > 6 || size(images) > 16 * 1024 * 1024) throw new BotError('photos-too-large');
  let total = size(images);
  for (const [id, state] of sessions) if (id !== user) total += size(state.images);
  if (total > 64 * 1024 * 1024) throw new BotError('photos-too-large');
  return images;
}
