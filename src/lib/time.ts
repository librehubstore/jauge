// Convertit une date « murale » d'un fuseau (ex. "2026-10-07 08:54:39" à Paris) en instant UTC.
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asZoned = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return new Date(guess - (asZoned - guess));
}

/** "2026-10-07 08:54:39" (ISO-like) */
export function parseIsoLocal(s: string, tz: string) {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?/);
  return m ? zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0), tz) : null;
}

/** "08/10/2026 07:49:13" (jj/mm/aaaa) */
export function parseDmyLocal(s: string, tz: string) {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):?(\d{2})?/);
  return m ? zonedToUtc(+m[3], +m[2], +m[1], +m[4], +m[5], +(m[6] ?? 0), tz) : null;
}
