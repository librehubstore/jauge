// Calculs de coût purs (spec 4.5). Distances en km, consommation en unités/100 km.

export const ROAD_FACTOR = 1.3; // vol d'oiseau → route estimée
export const STALE_HOURS = 48;
export const EXCLUDED_DAYS = 14;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

export const amountToAdd = (tankCapacity: number, level = 0.25) =>
  Math.max(0, tankCapacity * (1 - Math.min(1, Math.max(0, level))));

/** Distance routière aller-retour estimée depuis la position. */
export const detourKm = (crowKm: number) => crowKm * ROAD_FACTOR * 2;

export const detourCost = (crowKm: number, consumptionPer100: number, price: number) =>
  (detourKm(crowKm) * consumptionPer100 / 100) * price;

/** Coût total « meilleur choix » : plein + détour. */
export const bestChoiceCost = (price: number, amount: number, crowKm: number, consumptionPer100: number) =>
  price * amount + detourCost(crowKm, consumptionPer100, price);

export const savings = (medianPrice: number, price: number, amount: number, crowKm: number, consumptionPer100: number) =>
  (medianPrice - price) * amount - detourCost(crowKm, consumptionPer100, price);

export type Freshness = "fresh" | "stale" | "excluded";
/** maxDays : âge au-delà duquel un prix est ignoré (réglage utilisateur, 7 jours par défaut). */
export function freshness(updatedAt: Date, now = new Date(), maxDays = EXCLUDED_DAYS): Freshness {
  const h = (now.getTime() - updatedAt.getTime()) / 3_600_000;
  if (h > maxDays * 24) return "excluded";
  return h > STALE_HOURS ? "stale" : "fresh";
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Classe de prix en tiers (0 bas, 1 moyen, 2 haut) parmi les prix frais visibles. */
export function priceTiers(prices: number[]) {
  const s = [...prices].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const [t1, t2] = [q(1 / 3), q(2 / 3)];
  return (price: number) => (price <= t1 ? 0 : price <= t2 ? 1 : 2);
}
