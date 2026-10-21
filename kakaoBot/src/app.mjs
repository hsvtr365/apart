import { BotError } from './errors.mjs';

const dateOK = value => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
export function searchInput(input) {
  if (!input || typeof input !== 'object' || typeof input.query !== 'string' || input.query.length > 100
    || ![null, 'FOOD', 'NOTICE', 'MARKET'].includes(input.category) || !dateOK(input.date)) throw new BotError('search-input-invalid');
  if (input.noticeScope !== undefined && !["SHORT", "ROUTINE", "ALL"].includes(input.noticeScope)) throw new BotError("search-input-invalid");
  return { query: input.query.trim(), category: input.category, date: input.date, ...(input.noticeScope ? { noticeScope: input.noticeScope } : {}) };
}
export function publicResults(data) {
  if (!data || !dateOK(data.today) || !Array.isArray(data.posts) || data.posts.length > 500) throw new BotError('app-response-invalid');
  const fields = ['id', 'title', 'body', 'category', 'scheduleType', 'startDate', 'finishDate', 'noticeStartDate', 'noticeEndDate', 'noticeKind',
    'weekdays', 'seasons', 'arrivalTime', 'departureTime', 'presence', 'observedAt', 'presenceConfirmed'];
  const posts = data.posts.filter(p => p && !p.hidden && !p.adminDeleted && !p.userDeleted && !p.deletedAt
    && typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(p.id)
    && typeof p.title === 'string' && typeof p.body === 'string').slice(0, 50).map(p => {
      const result = Object.fromEntries(fields.filter(k => p[k] !== undefined).map(k => [k, p[k]]));
      result.title = p.title.slice(0, 100); result.body = p.body.slice(0, 1500);
      if (p.lastPresenceReport && ['ARRIVED', 'GONE'].includes(p.lastPresenceReport.state) && typeof p.lastPresenceReport.observedAt === 'string') {
        result.lastPresenceReport = { state: p.lastPresenceReport.state, observedAt: p.lastPresenceReport.observedAt };
      }
      return result;
    });
  return { today: data.today, posts, truncated: data.truncated === true || data.posts.length > 50 };
}
export function createApp(env, { signal, request = fetch } = {}) {
  const url = new URL(env.APP_INTERNAL_URL || 'http://127.0.0.1:28006/api/internal/bot');
  if (url.href !== 'http://127.0.0.1:28006/api/internal/bot') throw new BotError('app-url-invalid');
  const configured = typeof env.APP_BOT_SECRET === 'string' && env.APP_BOT_SECRET.length >= 32 && !/[\r\n]/.test(env.APP_BOT_SECRET);
  const assertReady = () => { if (!configured) throw new BotError('app-not-configured'); };
  async function call(body, json = false) {
    assertReady();
    try {
      const res = await request(url, { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${env.APP_BOT_SECRET}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }, body,
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(90_000)]),
      });
      if (res.status === 401 || res.status === 403) throw new BotError('app-auth-rejected');
      if (res.status === 404 || res.status === 503) throw new BotError('app-not-ready');
      const bytes = [];
      let size = 0;
      for await (const chunk of res.body) { size += chunk.length; if (size > 512 * 1024) throw new BotError('app-response-invalid'); bytes.push(chunk); }
      const data = JSON.parse(Buffer.concat(bytes).toString('utf8'));
      if (res.status === 400) return { validationError: typeof data.error === 'string' ? data.error.slice(0, 800) : '입력 정보를 확인해주세요.' };
      if (!res.ok) throw new BotError('app-unavailable');
      return data;
    } catch (e) { throw e instanceof BotError ? e : new BotError('app-unavailable'); }
  }
  return {
    configured, assertReady,
    search: async input => publicResults(await call(JSON.stringify(searchInput(input)), true)),
    publish: async (requestKey, post, images, forceDuplicate = false) => {
      if (!/^[a-f0-9]{64}$/.test(requestKey)) throw new BotError('publication-key-invalid');
      const form = new FormData();
      form.append('requestKey', requestKey); form.append('post', JSON.stringify(post)); form.append('forceDuplicate', String(forceDuplicate));
      for (const image of images) form.append('files', new Blob([Buffer.from(image.base64, 'base64')], { type: image.mime }), 'photo');
      const data = await call(form);
      if (data.validationError) return data;
      if (data.hidden || data.adminDeleted || data.userDeleted || data.deletedAt) throw new BotError('app-response-invalid');
      if (typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(data.id)) throw new BotError('app-response-invalid');
      return { id: data.id, candidate: data.candidate === true };
    },
  };
}
