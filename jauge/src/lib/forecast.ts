// Prévision « attendre ou faire le plein maintenant » (spec 4.9, V2) : fonctions pures.
import { priceAt } from "./trend";

const DAY = 86_400_000;
export const FORECAST_WEEKS = 12;
export const MIN_GAIN = 0.01; // €/L : en dessous, attendre ne vaut pas la peine
const HORIZON = 3; // jours

export type Forecast = {
  action: "now" | "wait";
  waitDays: number; // 0 si « maintenant »
  weekday: number; // jour conseillé, 0 = lundi
  gainPerUnit: number; // économie attendue par litre (ou kg)
  confidence: "low" | "medium" | "high";
  weeks: number;
  weekdayEffect: number[]; // écart moyen par jour de la semaine (lundi → dimanche)
};

/** Jour de la semaine (0 = lundi) d'un instant, dans le fuseau donné. */
export function weekdayIn(ts: number, timeZone: string) {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(ts));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d);
}

/** Pente (prix par jour) par moindres carrés. */
function slope(points: [number, number][]) {
  const n = points.length;
  if (n < 3) return 0;
  const mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  return den ? num / den : 0;
}

/**
 * @param series points [instant, prix] en escalier (un prix vaut jusqu'au suivant)
 * @param now instant de référence
 */
export function forecast(series: [number, number][], now: number, timeZone = "Europe/Paris"): Forecast | null {
  if (series.length < 4) return null;
  // Prix du jour à midi, sur les 12 dernières semaines.
  const days: { ts: number; wd: number; price: number }[] = [];
  for (let i = FORECAST_WEEKS * 7; i >= 1; i--) {
    const ts = now - i * DAY;
    const p = priceAt(series, ts);
    if (p !== null) days.push({ ts, wd: weekdayIn(ts, timeZone), price: p });
  }
  if (days.length < 28) return null;

  // Écart de chaque jour à la moyenne de sa semaine (semaines complètes seulement), puis moyenne par jour.
  const weeks: (typeof days)[] = [];
  let cur: typeof days = [];
  for (const d of days) {
    if (d.wd === 0 && cur.length) { weeks.push(cur); cur = []; }
    cur.push(d);
  }
  if (cur.length) weeks.push(cur);
  const full = weeks.filter((w) => w.length === 7);
  if (full.length < 3) return null;
  const sums = Array(7).fill(0), counts = Array(7).fill(0), below = Array(7).fill(0);
  let varied = 0;
  for (const w of full) {
    const mean = w.reduce((s, d) => s + d.price, 0) / 7;
    const moved = Math.max(...w.map((d) => d.price)) - Math.min(...w.map((d) => d.price)) > 0.0005;
    if (moved) varied++;
    for (const d of w) {
      const dev = d.price - mean;
      sums[d.wd] += dev; counts[d.wd]++;
      if (moved && dev < -0.0005) below[d.wd]++;
    }
  }
  const effect = sums.map((s, i) => (counts[i] ? s / counts[i] : 0));
  // Prix figés toute la période : pas de cycle, rien à prévoir.
  if (effect.every((e) => Math.abs(e) < 0.0005) && new Set(days.map((d) => d.price)).size === 1) return null;

  const trend = slope(days.slice(-14).map((d) => [(d.ts - now) / DAY, d.price]));
  const today = weekdayIn(now, timeZone);
  let best = { k: 0, change: 0 };
  for (let k = 1; k <= HORIZON; k++) {
    const wd = (today + k) % 7;
    const change = effect[wd] - effect[today] + trend * k;
    if (change < best.change) best = { k, change };
  }
  // Régularité : parmi les semaines où le prix a bougé, part de celles où le jour visé était sous la moyenne.
  const target = (today + best.k) % 7;
  const regular = varied ? below[target] / varied : 0;
  const confidence = full.length >= 8 && regular >= 0.6 ? "high" : full.length >= 5 && regular >= 0.4 ? "medium" : "low";

  const wait = best.k > 0 && -best.change >= MIN_GAIN;
  return {
    action: wait ? "wait" : "now", waitDays: wait ? best.k : 0, weekday: wait ? target : today,
    gainPerUnit: wait ? -best.change : 0, confidence, weeks: full.length, weekdayEffect: effect,
  };
}
