import { isLongNotice } from './notice-kind.mjs';
export function noticeScope(question) {
  const q = question.replace(/\s+/g, '');
  if (/전체|모든|전부|일상.*단기|단기.*일상/.test(q)) return 'all';
  return /일상|상시/.test(q) ? 'routine' : 'short';
}
export async function filterNotices(posts, scope) {
  if (scope === 'all') return posts;
  return posts.filter(p => p.category !== 'NOTICE' ||
    (isLongNotice(p.noticeStartDate, p.noticeEndDate) || p.noticeKind === 'ROUTINE' ? 'routine' : 'short') === scope);
}
