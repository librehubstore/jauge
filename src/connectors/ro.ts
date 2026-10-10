import type { FuelCode } from "@/lib/fuels";
import { parseDmyLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// Monitorul Prețurilor Carburanților (Consiliul Concurenței) : recherche par cercle de 5 km au plus,
// donc pas d'import national. Grandes villes en planifié, ailleurs rafraîchissement à la demande (refreshRomaniaArea).
const API = "https://monitorulpreturilor.info/pmonsvc/Gas/GetGasItemsByLatLon";
const PRODUCTS: Record<string, FuelCode> = { "11": "E5", "12": "E5_98", "21": "B7", "22": "B7_PREMIUM", "31": "LPG" };
const SERVICE: Record<string, string> = { "1": "shop", "2": "wash", "3": "food", "4": "toilets", "5": "atm" };
const MAX_BUFFER_M = 5000;
const CITIES: [number, number][] = [
  [44.4268, 26.1025], [46.7712, 23.6236], [45.7489, 21.2087], [47.1585, 27.6014], [44.1598, 28.6348], [45.6427, 25.5887],
  [44.3302, 23.7949], [45.4353, 28.0080], [46.5455, 24.5625], [47.0465, 21.9189], [45.7983, 24.1256], [44.9419, 26.0225],
];

type RoResponse = {
  Stations?: { id: string; name: string; updatedate: string; network?: { name: string }; addr: { addrstring: string; location: { Lat: number; Lon: number } } }[];
  Products?: { stationid: string; price: number; catprod: { id: string } }[];
  services?: { id: string; stationid: string }[];
};

export function parseRo(responses: RoResponse[]): RawStation[] {
  const by = new Map<string, RawStation>();
  const updatedAt = new Map<string, Date>(); // date portée par la station, appliquée à ses prix
  for (const r of responses) {
    for (const s of r.Stations ?? []) {
      if (by.has(s.id)) continue;
      updatedAt.set(s.id, parseDmyLocal(s.updatedate, "Europe/Bucharest") ?? new Date());
      by.set(s.id, {
        externalId: s.id, name: s.name?.trim() || null, brand: s.network?.name?.trim() || null,
        address: s.addr.addrstring?.trim() || null, postalCode: null, city: null,
        lat: s.addr.location.Lat, lon: s.addr.location.Lon, roadType: "unknown", is24hAutomat: false,
        services: [], paymentMethods: [], prices: [], outages: [],
      });
    }
    for (const p of r.Products ?? []) {
      const st = by.get(p.stationid), fuel = PRODUCTS[p.catprod.id];
      if (!st || !fuel || !(p.price > 1) || st.prices.some((x) => x.fuel === fuel)) continue;
      st.prices.push({ fuel, price: p.price, updatedAt: updatedAt.get(p.stationid)! });
    }
    for (const sv of r.services ?? []) {
      const st = by.get(sv.stationid), key = SERVICE[sv.id];
      if (st && key && !st.services.includes(key)) st.services.push(key);
    }
  }
  return [...by.values()];
}

/** Un point = une requête par produit : la source renvoie des listes vides si plusieurs produits sont demandés. */
// ponytail: 50 résultats au plus par requête, donc incomplet au centre de Bucarest ; resserrer la grille si besoin.
export async function fetchRoPoint(lat: number, lon: number) {
  return Promise.all(Object.keys(PRODUCTS).map(async (id) => {
    const q = new URLSearchParams({ lon: lon.toFixed(5), lat: lat.toFixed(5), buffer: String(MAX_BUFFER_M), CSVGasCatalogProductIds: id });
    const res = await fetchWithRetry(`${API}?${q}`, { headers: { Accept: "application/json" } }, 2);
    return (await res.json()) as RoResponse;
  }));
}

/** Centres de cercles de 5 km couvrant un disque (pas de 7 km, recouvrement suffisant). */
export function gridPoints(lat: number, lon: number, radiusKm: number) {
  const step = 7, out: [number, number][] = [];
  const n = Math.ceil(radiusKm / step);
  const kmLat = 1 / 111, kmLon = 1 / (111 * Math.cos((lat * Math.PI) / 180));
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    if (Math.hypot(i * step, j * step) <= radiusKm + step / 2) out.push([lat + i * step * kmLat, lon + j * step * kmLon]);
  }
  return out;
}

export const inRomania = (lat: number, lon: number) => lat > 43.6 && lat < 48.3 && lon > 20.2 && lon < 29.8;

export const ro: Connector = {
  id: "ro", country: "RO", name: "Monitorul Prețurilor Carburanților", currency: "RON",
  license: "Données publiques du Consiliul Concurenței", attribution: "Consiliul Concurenței — monitorulpreturilor.info (zones consultées et grandes villes)",
  url: "https://monitorulpreturilor.info/", schedule: "35 */2 * * *",
  async fetch() {
    const responses: RoResponse[] = [];
    for (const [lat, lon] of CITIES) responses.push(...(await fetchRoPoint(lat, lon)));
    return parseRo(responses);
  },
};
