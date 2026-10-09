import type { FuelCode } from "@/lib/fuels";
import { parseDmyLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

const TZ = "Europe/Rome";

// Descriptions MIMIT → codes harmonisés ; les variantes commerciales premium sont regroupées.
export function mapItFuel(desc: string): FuelCode | null {
  const d = desc.toLowerCase();
  if (d === "benzina") return "E5";
  if (d === "gasolio") return "B7";
  if (d === "gpl") return "LPG";
  if (d === "metano" || d === "l-gnc") return "CNG";
  if (d === "gnl") return "LNG";
  if (d.includes("hvo")) return "XTL";
  if (/diesel|gasolio/.test(d)) return "B7_PREMIUM";
  if (/benzina|super|98|100|f101/.test(d)) return "E5_98";
  return null;
}

// Deux premières lignes : « Estrazione del … » puis l'en-tête.
const lines = (csv: string) => csv.split(/\r?\n/).slice(2).filter(Boolean).map((l) => l.split("|"));

export function parseIt(anagrafica: string, prezzi: string): RawStation[] {
  const byId = new Map<string, RawStation>();
  for (const c of lines(anagrafica)) {
    if (c.length !== 10) continue; // ligne mal formée (| dans un nom)
    const [id, , bandiera, tipo, nome, indirizzo, comune, , lat, lon] = c;
    const la = Number(lat), lo = Number(lon);
    if (!la || !lo) continue;
    byId.set(id, {
      externalId: id, name: nome.replace(/\s+/g, " ").trim() || null,
      brand: bandiera === "Pompe Bianche" ? null : bandiera || null,
      address: indirizzo.trim() || null, city: comune || null, postalCode: null, lat: la, lon: lo,
      roadType: tipo === "Autostradale" ? "motorway" : tipo === "Stradale" ? "road" : "unknown",
      is24hAutomat: false, services: [], paymentMethods: [], prices: [], outages: [],
    });
  }
  // Prix libre-service préféré au prix servi ; à égalité de mode, le moins cher.
  const best = new Map<string, { self: boolean; price: number; at: Date }>();
  for (const [id, desc, prezzo, isSelf, dt] of lines(prezzi)) {
    const fuel = mapItFuel(desc ?? ""); const at = parseDmyLocal(dt ?? "", TZ);
    if (!fuel || !at || !byId.has(id)) continue;
    const key = `${id}|${fuel}`, self = isSelf === "1", price = Number(prezzo);
    const cur = best.get(key);
    if (!cur || (self && !cur.self) || (self === cur.self && price < cur.price)) best.set(key, { self, price, at });
  }
  for (const [key, v] of best) {
    const [id, fuel] = key.split("|");
    byId.get(id)!.prices.push({ fuel: fuel as FuelCode, price: v.price, updatedAt: v.at });
  }
  return [...byId.values()];
}

export const it: Connector = {
  id: "it", country: "IT", name: "MIMIT — Osservaprezzi Carburanti", currency: "EUR",
  license: "IODL 2.0", attribution: "Ministero delle Imprese e del Made in Italy",
  url: "https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti",
  schedule: "30 9 * * *",
  async fetch() {
    const base = "https://www.mimit.gov.it/images/exportCSV/";
    const [a, p] = await Promise.all([
      fetchWithRetry(base + "anagrafica_impianti_attivi.csv").then((r) => r.text()),
      fetchWithRetry(base + "prezzo_alle_8.csv").then((r) => r.text()),
    ]);
    return parseIt(a, p);
  },
};
