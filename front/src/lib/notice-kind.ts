export function isLongNotice(start: string | null | undefined, end: string | null | undefined) {
  if (typeof start !== 'string' || typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  const d = new Date(start + 'T00:00:00Z');
  if (Number.isNaN(+d) || d.toISOString().slice(0, 10) !== start) return false;
  const year = d.getUTCFullYear(), month = d.getUTCMonth();
  const last = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const threshold = new Date(Date.UTC(year, month + 1, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
  return end >= threshold;
}
