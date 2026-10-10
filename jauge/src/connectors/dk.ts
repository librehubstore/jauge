import type { FuelCode } from "@/lib/fuels";
import { parseIsoLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// Danemark : depuis le 1er janvier 2026, chaque enseigne publie ses prix par station via une API (§ 16 a).
// ponytail: OK et Shell seulement (coordonnées fournies, sans authentification) ; Q8/F24 sans coordonnées,
// Circle K et Uno-X avec accès restreint. Ajouter les autres enseignes quand leur accès est ouvert.
const OK_API = "https://mobility-prices.ok.dk/api/v1/fuel-prices";
const SHELL_API = "https://shellpumpepriser.geoapp.me/v1/prices";

/** Au Danemark, le « Blyfri 95 » vendu en pompe est de l'E10 depuis 2020. */
function mapProduct(name: string): FuelCode | null {
  const n = name.toLowerCase();
  if (/v-power diesel|diesel\+|premium diesel/.test(n)) return "B7_PREMIUM";
  if (/diesel/.test(n)) return "B7";
  if (/100|v-power$|v-power 100/.test(n)) return "E5_98";
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

export const dk: Connector = {
  id: "dk", country: "DK", name: "API des enseignes (OK, Shell)", currency: "DKK",
  license: "Données publiées au titre du § 16 a (prix des carburants)", attribution: "OK a.m.b.a., Shell Danmark — couverture partielle (enseignes avec API ouverte)",
  url: "https://kfst.dk/vejledninger/kfst/dansk/2025/20251216-vejledning-om-api-til-offentliggoerelse-af-prisoplysninger-for-motorbraendstof",
  schedule: "25 * * * *",
  async fetch() {
    const [ok, shell] = await Promise.all([
      fetchWithRetry(OK_API, { headers: { Accept: "application/json" } }).then((r) => r.json() as Promise<{ items: OkItem[] }>),
      fetchWithRetry(SHELL_API, { headers: { Accept: "application/json" } }).then((r) => r.json() as Promise<ShellItem[]>),
    ]);
    return [...parseDkOk(ok.items), ...parseDkShell(shell)];
  },
};
