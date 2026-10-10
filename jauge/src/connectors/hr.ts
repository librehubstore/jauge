import { gunzipSync } from "node:zlib";
import type { FuelCode } from "@/lib/fuels";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// Ministère croate de l'Économie (mzoe-gor.hr) : fichier national data.gz chargé par l'application officielle.
const DATA = "https://webservis.mzoe-gor.hr/data.gz";

// vrsta_goriva → famille. La mention « avec/sans additifs » ne distingue pas standard et premium :
// beaucoup de stations ne vendent qu'un gazole « avec additifs ». Gazole : le moins cher = B7, le plus cher = premium.
const KIND: Record<number, FuelCode | "DIESEL"> = { 1: "E5", 2: "E5", 5: "E5_98", 6: "E5_98", 7: "DIESEL", 8: "DIESEL", 9: "LPG", 26: "CNG" };
const MAX_PRICE = 4; // €/L : au-delà, saisie erronée côté source
// opcija → service ; 19 = ouvert 24 h/24
const OPTION: Record<number, string> = { 1: "repair", 2: "wash", 4: "wifi", 5: "atm", 6: "toilets", 8: "shop", 9: "food", 10: "food", 20: "ev" };

type HrData = {
  postajas: { id: number; naziv: string; adresa: string; mjesto: string; obveznik_id: number; long: string; lat: string;
    radnaVremena: { vrsta_dana_id: number; pocetak: string; kraj: string }[]; opcije: { opcija_id?: number; id?: number }[];
    cjenici: { gorivo_id: number; cijena: number }[] }[];
  gorivos: { id: number; vrsta_goriva_id: number }[];
  obvezniks: { id: number; naziv: string }[];
};

/** Le fichier inverse parfois lat et long : la latitude croate est entre 42 et 47, la longitude entre 13 et 20. */
function coords(a: number, b: number) {
  const isLat = (v: number) => v > 41.5 && v < 47;
  return isLat(a) && !isLat(b) ? { lat: a, lon: b } : { lat: b, lon: a };
}

export function parseHr(d: HrData, fetchedAt = new Date()): RawStation[] {
  const kindOf = new Map(d.gorivos.map((g) => [g.id, g.vrsta_goriva_id]));
  const brandOf = new Map(d.obvezniks.map((o) => [o.id, o.naziv.trim()]));
  return d.postajas.flatMap((p) => {
    const { lat, lon } = coords(Number(p.long), Number(p.lat));
    if (!lat || !lon) return [];
    const byFamily = new Map<FuelCode | "DIESEL", number[]>();
    for (const c of p.cjenici) {
      const kind = kindOf.get(c.gorivo_id);
      const fam = kind !== undefined ? KIND[kind] : undefined;
      if (fam && c.cijena > 0.3 && c.cijena < MAX_PRICE) byFamily.set(fam, [...(byFamily.get(fam) ?? []), c.cijena]);
    }
    const best = new Map<FuelCode, number>();
    for (const [fam, list] of byFamily) {
      const lo = Math.min(...list), hi = Math.max(...list);
      if (fam !== "DIESEL") best.set(fam, lo);
      else { best.set("B7", lo); if (hi > lo) best.set("B7_PREMIUM", hi); }
    }
    const options = p.opcije.map((o) => o.opcija_id ?? o.id ?? 0);
    // Horaires : 1 = jours ouvrés (lundi-vendredi), 2 = samedi, 3 = dimanche. Plages coupées fusionnées (une ligne par jour).
    const byDay = new Map<number, { weekday: number; opens: string; closes: string; isClosed: boolean }>();
    for (const h of p.radnaVremena) {
      const days = h.vrsta_dana_id === 1 ? [0, 1, 2, 3, 4] : h.vrsta_dana_id === 2 ? [5] : h.vrsta_dana_id === 3 ? [6] : [];
      for (const weekday of days) {
        const opens = h.pocetak.slice(0, 5), closes = h.kraj.slice(0, 5), cur = byDay.get(weekday);
        byDay.set(weekday, cur ? { ...cur, opens: opens < cur.opens ? opens : cur.opens, closes: closes > cur.closes ? closes : cur.closes } : { weekday, opens, closes, isClosed: false });
      }
    }
    const hours = [...byDay.values()];
    const brand = brandOf.get(p.obveznik_id);
    return [{
      externalId: String(p.id), name: p.naziv.trim() || null, brand: brand && brand !== "-" ? brand : null,
      address: p.adresa?.trim() || null, postalCode: null, city: p.mjesto?.trim() || null, lat, lon,
      roadType: "unknown" as const, is24hAutomat: options.includes(19), hours,
      services: [...new Set(options.map((o) => OPTION[o]).filter(Boolean))], paymentMethods: [], outages: [],
      prices: [...best].map(([fuel, price]) => ({ fuel, price, updatedAt: fetchedAt })),
    }];
  });
}

export const hr: Connector = {
  id: "hr", country: "HR", name: "Ministarstvo gospodarstva — mzoe-gor.hr", currency: "EUR",
  license: "Données publiques du ministère croate de l'Économie", attribution: "Ministarstvo gospodarstva Republike Hrvatske — mzoe-gor.hr",
  url: "https://mzoe-gor.hr/", schedule: "10 */2 * * *",
  async fetch() {
    const buf = Buffer.from(await (await fetchWithRetry(DATA)).arrayBuffer());
    let text: string;
    try { text = gunzipSync(buf).toString("utf8"); } catch { text = buf.toString("utf8"); }
    return parseHr(JSON.parse(text));
  },
};
