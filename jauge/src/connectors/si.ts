import type { FuelCode } from "@/lib/fuels";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// goriva.si (ministère slovène de l'Économie) : API JSON paginée, ~550 stations, sans horodatage par prix.
const API = "https://goriva.si/api/v1";
const FUEL: Record<string, FuelCode> = {
  "95": "E5", "98": "E5_98", "100": "E5_98", dizel: "B7", "dizel-premium": "B7_PREMIUM",
  "avtoplin-lpg": "LPG", hvo: "XTL", cng: "CNG", lng: "LNG",
};

type SiStation = { pk: number; franchise: number; name: string; address: string; lat: number; lng: number; prices: Record<string, number | null>; open_hours?: string; zip_code?: string };

export function parseSi(results: SiStation[], franchises: { pk: number; name: string }[], fetchedAt = new Date()): RawStation[] {
  const brandOf = new Map(franchises.map((f) => [f.pk, f.name.replace(/,.*$/, "").replace(/\s+(d\.d\.|d\.o\.o\.).*$/i, "").trim()]));
  return results.flatMap((s) => {
    if (!s.lat || !s.lng) return [];
    const prices = new Map<FuelCode, number>();
    // « 98 » prime sur « 100 » pour E5_98 ; 0,001 sert de valeur vide côté source.
    for (const [k, fuel] of Object.entries(FUEL)) {
      const v = s.prices[k];
      if (typeof v === "number" && v > 0.3 && !prices.has(fuel)) prices.set(fuel, v);
    }
    const hours = (s.open_hours ?? "").toLowerCase();
    return [{
      externalId: String(s.pk), name: s.name.trim() || null, brand: brandOf.get(s.franchise) ?? null,
      address: s.address?.trim() || null, postalCode: s.zip_code ?? null, city: null,
      lat: s.lat, lon: s.lng, roadType: "unknown" as const,
      is24hAutomat: /24 ?ur|24\/7|neprenehoma|00:00-23:59/.test(hours), services: [], paymentMethods: [], outages: [],
      prices: [...prices].map(([fuel, price]) => ({ fuel, price, updatedAt: fetchedAt })),
    }];
  });
}

export const si: Connector = {
  id: "si", country: "SI", name: "goriva.si", currency: "EUR",
  license: "Données publiques du ministère slovène de l'Économie", attribution: "Ministrstvo za gospodarstvo — goriva.si",
  url: "https://goriva.si/", schedule: "5 */3 * * *",
  async fetch() {
    const franchises = (await (await fetchWithRetry(`${API}/franchise/`)).json()) as { pk: number; name: string }[];
    const results: SiStation[] = [];
    let url: string | null = `${API}/search/?position=&radius=&franchise=&name=&o=`;
    for (let page = 0; url && page < 100; page++) {
      const j = (await (await fetchWithRetry(url)).json()) as { next: string | null; results: SiStation[] };
      results.push(...j.results);
      url = j.next;
    }
    return parseSi(results, franchises);
  },
};
