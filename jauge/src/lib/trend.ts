// Fonctions pures, utilisables côté client (sans accès base).
export const TREND_THRESHOLD = 0.01; // €/L sur 7 jours

export type Trend = "up" | "down" | "stable";

/** Prix en vigueur à une date donnée, à partir d'une série triée. */
export function priceAt(series: [number, number][], t: number) {
  let v: number | null = null;
  for (const [ts, p] of series) if (ts <= t) v = p; else break;
  return v;
}

/** Tendance sur 7 jours : écart du prix actuel avec celui d'il y a 7 jours. */
export function trendOf(series: [number, number][], now = Date.now()): Trend | null {
  const cur = priceAt(series, now), before = priceAt(series, now - 7 * 86_400_000);
  if (cur === null || before === null) return null;
  const d = cur - before;
  return d > TREND_THRESHOLD ? "up" : d < -TREND_THRESHOLD ? "down" : "stable";
}
