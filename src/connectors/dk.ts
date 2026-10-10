import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { station } from "@/db/schema";
import type { FuelCode } from "@/lib/fuels";
import { parseIsoLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// Danemark : depuis le 1er janvier 2026, chaque enseigne publie ses prix par station via une API (§ 16 a).
// OK et Shell (coordonnées fournies), Q8/F24 (adresse seule, géocodée une fois via Photon).
// ponytail: Circle K et Uno-X absents (accès restreint) ; les ajouter quand leur API sera ouverte.
const OK_API = "https://mobility-prices.ok.dk/api/v1/fuel-prices";
const SHELL_API = "https://shellpumpepriser.geoapp.me/v1/prices";
const Q8_API = "https://beta.q8.dk/Station/GetStationPrices?page=1&pageSize=2000";
const PHOTON = process.env.PHOTON_URL ?? "https://photon.komoot.io";
const DK_BBOX = "7.9,54.5,15.3,57.8";

/** Au Danemark, le « Blyfri 95 » vendu en pompe est de l'E10 depuis 2020 ; l'E5 est nommé explicitement. */
export function mapProduct(name: string): FuelCode | null {
  const n = name.toLowerCase();
  if (/hvo/.test(n)) return "XTL";
  if (/diesel extra/.test(n)) return "B7_PREMIUM";
  if (/v-power diesel|diesel\+|premium diesel/.test(n)) return "B7_PREMIUM";
  if (/diesel/.test(n)) return "B7";
  if (/100|v-power$|v-power 100/.test(n)) return "E5_98";
  if (/\be5\b/.test(n)) return "E5";
  if (/95/.test(n)) return "E10";
  return null;
}

type OkItem = { facility_number: number; street: string; house_number: string; postal_code: number; city: string; coordinates: { latitude: number; longitude: number }; last_updated_time: string; prices: { product_name: string; price: number }[] };
type ShellItem = { stationId: string; street: string; houseNumber: string | null; postalCode: string; city: string; coordinates: { latitude: string; longitude: string }; prices: { productName: string; price: string; lastUpdated: string }[] };

export function parseDkOk(items: OkItem[]): RawStation[] {
  return items.map((s) => ({
    externalId: `ok-${s.facility_number}`, name: `OK ${s.city}`, brand: "OK",
    address: [s.street, s.house_number].filter(Boolean).join(" ") || null, postalCode: String(s.postal_code), city: s.city,
    lat: s.coordinates.latitude, lon: s.coordinates.longitude, roadType: "unknown" as const,
    is24hAutomat: false, services: [], paymentMethods: [], outages: [],
    prices: s.prices.flatMap((p) => {
      const fuel = mapProduct(p.product_name);
      return fuel && p.price > 1 ? [{ fuel, price: p.price, updatedAt: new Date(s.last_updated_time) }] : [];
    }),
  }));
}

export function parseDkShell(items: ShellItem[]): RawStation[] {
  return items.map((s) => ({
    externalId: `shell-${s.stationId}`, name: `Shell ${s.city}`, brand: "Shell",
    address: [s.street, s.houseNumber].filter(Boolean).join(" ") || null, postalCode: s.postalCode, city: s.city,
    lat: Number(s.coordinates.latitude), lon: Number(s.coordinates.longitude), roadType: "unknown" as const,
    is24hAutomat: false, services: [], paymentMethods: [], outages: [],
    prices: s.prices.flatMap((p) => {
      const fuel = mapProduct(p.productName), at = parseIsoLocal(p.lastUpdated, "Europe/Copenhagen");
      return fuel && at && Number(p.price) > 1 ? [{ fuel, price: Number(p.price), updatedAt: at }] : [];
    }),
  }));
}

type Q8Item = { stationId: string; stationName: string; address: string; products: { productName: string; price: number; priceChangeDate: string }[] };

/** « Dronningemaen 34 Svendborg 5700 Danmark » → texte à géocoder, rue et code postal. */
export function splitQ8Address(address: string) {
  const q = address.replace(/\s*Danmark\s*$/i, "").trim();
  const m = q.match(/^(.*?)\s+(\S+)\s+(\d{4})$/);
  return { q, street: m?.[1] ?? q, city: m?.[2] ?? null, postalCode: m?.[3] ?? null };
}

export function parseDkQ8(items: Q8Item[], coords: Map<string, [number, number]>): RawStation[] {
  return items.flatMap((s) => {
    const id = `q8-${s.stationId}`, at = coords.get(id);
    if (!at) return [];
    const { street, city, postalCode } = splitQ8Address(s.address);
    const brand = /f24/i.test(s.stationName) ? "F24" : "Q8";
    const prices = new Map<FuelCode, { price: number; updatedAt: Date }>();
    for (const p of s.products) {
      const fuel = mapProduct(p.productName), updatedAt = parseIsoLocal(p.priceChangeDate, "Europe/Copenhagen");
      if (fuel && updatedAt && p.price > 1 && !prices.has(fuel)) prices.set(fuel, { price: p.price, updatedAt });
    }
    return [{
      externalId: id, name: city ? `${brand} ${city}` : brand, brand,
      address: street, postalCode, city, lat: at[0], lon: at[1], roadType: "unknown" as const,
      is24hAutomat: brand === "F24", services: [], paymentMethods: [], outages: [],
      prices: [...prices].map(([fuel, v]) => ({ fuel, ...v })),
    }];
  });
}

/** Coordonnées Q8/F24 : celles déjà en base, sinon géocodage Photon (code postal vérifié), une requête par seconde. */
async function q8Coords(items: Q8Item[]) {
  const known = await db.select({ id: station.externalId, lat: sql<number>`ST_Y(${station.location})`, lon: sql<number>`ST_X(${station.location})` })
    .from(station).where(and(eq(station.sourceId, "dk"), like(station.externalId, "q8-%")));
  const coords = new Map(known.map((k) => [k.id, [Number(k.lat), Number(k.lon)] as [number, number]]));
  for (const s of items) {
    const id = `q8-${s.stationId}`;
    if (coords.has(id)) continue;
    const { q, postalCode } = splitQ8Address(s.address);
    try {
      const r = await fetchWithRetry(`${PHOTON}/api/?limit=1&lang=en&bbox=${DK_BBOX}&q=${encodeURIComponent(q)}`, {}, 2);
      const hit = ((await r.json()) as { features: { geometry: { coordinates: [number, number] }; properties: { postcode?: string } }[] }).features[0];
      if (hit && (!postalCode || hit.properties.postcode === postalCode)) coords.set(id, [hit.geometry.coordinates[1], hit.geometry.coordinates[0]]);
    } catch { /* reprise au prochain passage */ }
    await new Promise((res) => setTimeout(res, 1100));
  }
  return coords;
}

export const dk: Connector = {
  id: "dk", country: "DK", name: "API des enseignes (OK, Shell, Q8, F24)", currency: "DKK",
  license: "Données publiées au titre du § 16 a (prix des carburants)", attribution: "OK a.m.b.a., Shell Danmark, Q8 Danmark (Q8, F24) — couverture partielle ; géocodage © OpenStreetMap (Photon)",
  url: "https://kfst.dk/vejledninger/kfst/dansk/2025/20251216-vejledning-om-api-til-offentliggoerelse-af-prisoplysninger-for-motorbraendstof",
  schedule: "25 * * * *",
  async fetch() {
    const json = { headers: { Accept: "application/json" } };
    const [ok, shell, q8] = await Promise.all([
      fetchWithRetry(OK_API, json).then((r) => r.json() as Promise<{ items: OkItem[] }>),
      fetchWithRetry(SHELL_API, json).then((r) => r.json() as Promise<ShellItem[]>),
      fetchWithRetry(Q8_API, json).then((r) => r.json() as Promise<{ data: { stationsPrices: Q8Item[] } }>),
    ]);
    const q8Items = q8.data.stationsPrices;
    return [...parseDkOk(ok.items), ...parseDkShell(shell), ...parseDkQ8(q8Items, await q8Coords(q8Items))];
  },
};
