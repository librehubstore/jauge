// Taux de change quotidiens de la BCE (base EUR). Fonctions de conversion pures, utilisables côté client.

export type Rates = { date: string; rates: Record<string, number> };

/** Devises proposées : l'euro et celles publiées par la BCE qui concernent l'Europe. */
export const DISPLAY_CURRENCIES = ["EUR", "GBP", "CHF", "DKK", "SEK", "NOK", "PLN", "CZK", "HUF", "RON", "ISK", "USD"] as const;

export function parseEcbXml(xml: string): Rates | null {
  const date = xml.match(/time='([\d-]+)'/)?.[1];
  const rates = Object.fromEntries([...xml.matchAll(/currency='(\w{3})' rate='([\d.]+)'/g)].map((m) => [m[1], Number(m[2])]));
  return date && Object.keys(rates).length ? { date, rates: { EUR: 1, ...rates } } : null;
}

/** Convertit un montant entre deux devises via l'euro ; null si un taux manque. */
export function convert(value: number, from: string, to: string, rates: Record<string, number>) {
  if (from === to) return value;
  const a = rates[from], b = rates[to];
  return a && b ? (value / a) * b : null;
}
