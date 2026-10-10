import type { FuelCode } from "@/lib/fuels";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// Couche ArcGIS publique du Govern d'Andorra (« Preu dels carburants actuals ») : ~60 stations, une ligne par station × produit.
const ENDPOINT = "https://sig.govern.ad/server/rest/services/CARBURANTS/CARBURANTS/FeatureServer/1/query";
const PRODUCT: Record<number, FuelCode> = { 4: "E5", 5: "E5_98", 6: "B7", 8: "B7_PREMIUM", 9: "ADBLUE", 11: "LPG" };

type Feature = {
  attributes: { idIPE: number; idProducte: number; PREU: number | null; DataInici: number | null; NOM?: string; Parroquia?: string };
  geometry?: { rings?: number[][][] };
};

/** Centre de l'emprise de la station (le flux ne donne pas de point). */
function centroid(rings?: number[][][]) {
  const r = rings?.[0];
  if (!r?.length) return null;
  const [x, y] = r.reduce(([a, b], [px, py]) => [a + px, b + py], [0, 0]);
  return { lon: x / r.length, lat: y / r.length };
}

export function parseAd(features: Feature[]): RawStation[] {
  const by = new Map<number, RawStation>();
  for (const f of features) {
    const a = f.attributes;
    let s = by.get(a.idIPE);
    if (!s) {
      s = {
        externalId: String(a.idIPE), name: a.NOM?.trim() || null, brand: null, address: null, postalCode: null,
        city: a.Parroquia ?? null, lat: 0, lon: 0, roadType: "road", is24hAutomat: false,
        services: [], paymentMethods: [], prices: [], outages: [],
      };
      by.set(a.idIPE, s);
    }
    const c = centroid(f.geometry?.rings);
    if (c && !s.lat) Object.assign(s, c);
    const fuel = PRODUCT[a.idProducte];
    if (fuel && a.PREU && a.PREU > 0.3 && a.PREU < 5 && a.DataInici) {
      s.prices.push({ fuel, price: a.PREU, updatedAt: new Date(a.DataInici) });
      if (fuel === "ADBLUE") s.services.push("adblue");
    }
  }
  // Les distributeurs de fioul domestique partagent le flux : sans carburant routier, ce n'est pas une station.
  return [...by.values()].filter((s) => s.lat && s.prices.some((p) => p.fuel !== "ADBLUE"));
}

export const ad: Connector = {
  id: "ad", country: "AD", name: "Govern d'Andorra — Preu dels carburants", currency: "EUR",
  license: "Dades obertes del Govern d'Andorra", attribution: "Govern d'Andorra — Oficina de l'Energia i del Canvi Climàtic",
  url: "https://sig.govern.ad/IPE/PreusCarburants", schedule: "20 */2 * * *",
  async fetch() {
    const q = new URLSearchParams({ where: "1=1", outFields: "idIPE,idProducte,PREU,DataInici,NOM,Parroquia", returnGeometry: "true", outSR: "4326", f: "json" });
    const res = await fetchWithRetry(`${ENDPOINT}?${q}`);
    const j = (await res.json()) as { features?: Feature[]; error?: unknown };
    if (!j.features) throw new Error("AD: réponse sans données");
    return parseAd(j.features);
  },
};
