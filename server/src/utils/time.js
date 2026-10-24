// Time-zone helpers using Intl only (no extra dependency).
export function zonedParts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, dow, ymd: `${p.year}-${p.month}-${p.day}` };
}
/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedToUtc(ymd, hhmm, timeZone) {
  const [y, m, d] = ymd.split('-').map(Number); const [hh, mm] = hhmm.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let guess = new Date(target);
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(guess, timeZone);
    guess = new Date(guess.getTime() - (Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - target));
  }
  return guess;
}
export const isValidTimeZone = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };
export const addDays = (ymd, n) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
