// [weekday (0 = lundi), opens "HH:MM" | null, closes "HH:MM" | null, isClosed]
export type Hours = [number, string | null, string | null, boolean][];

// ponytail: un fuseau par pays ; les DOM et les Canaries héritent du fuseau métropolitain. Passer au fuseau par station si besoin.
export const TZ_BY_COUNTRY: Record<string, string> = { FR: "Europe/Paris", ES: "Europe/Madrid", IT: "Europe/Rome", PT: "Europe/Lisbon", DE: "Europe/Berlin", AT: "Europe/Vienna", GB: "Europe/London", AD: "Europe/Andorra" };

export function localNow(country: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_BY_COUNTRY[country] ?? "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)!.value;
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(g("weekday"));
  return { weekday, hhmm: `${g("hour")}:${g("minute")}` };
}

/** Ouvert à l'instant donné ; gère les plages qui passent minuit et « 00:00-00:00 » = 24 h. */
export function isOpenAt(hours: Hours, country: string, now: Date) {
  const { weekday, hhmm } = localNow(country, now);
  const day = hours.find((h) => h[0] === weekday);
  if (!day) return null;
  const [, opens, closes, closed] = day;
  if (closed) return false;
  if (!opens || !closes) return null;
  if (opens === closes) return true;
  return opens < closes ? hhmm >= opens && hhmm < closes : hhmm >= opens || hhmm < closes;
}
