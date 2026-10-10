import type { FuelCode } from "@/lib/fuels";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// API publique E-Control (Spritpreisrechner) : par district, seules les stations les moins chères sont publiées
// (obligation légale autrichienne) → couverture partielle, signalée dans l'attribution.
const API = "https://api.e-control.at/sprit/1.0";
const FUELS: [string, FuelCode][] = [["DIE", "B7"], ["SUP", "E5"], ["GAS", "CNG"]];
const DAYS = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];

type AtStation = {
  id: number; name?: string; open?: boolean;
  location: { address?: string; postalCode?: string; city?: string; latitude: number; longitude: number };
  openingHours?: { day: string; from: string; to: string }[];
  paymentMethods?: { cash?: boolean; debitCard?: boolean; creditCard?: boolean };
  prices?: { fuelType: string; amount: number }[];
};

/** Fusionne les réponses (une par district × carburant) en stations. */
export function parseAt(responses: AtStation[][], fetchedAt = new Date()): RawStation[] {
  const by = new Map<number, RawStation>();
  for (const list of responses) {
    for (const s of list) {
      let r = by.get(s.id);
      if (!r) {
        const hours = (s.openingHours ?? []).filter((h) => DAYS.includes(h.day)).map((h) => ({
          weekday: DAYS.indexOf(h.day), opens: h.from, closes: h.to === "24:00" ? "00:00" : h.to, isClosed: false,
        }));
        r = {
          externalId: String(s.id), name: s.name?.trim() || null, brand: null,
          address: s.location.address?.trim() || null, postalCode: s.location.postalCode ?? null, city: s.location.city ?? null,
          lat: s.location.latitude, lon: s.location.longitude, roadType: "unknown",
          is24hAutomat: hours.length === 7 && hours.every((h) => h.opens === "00:00" && h.closes === "00:00"),
          hours, services: [], paymentMethods: s.paymentMethods?.creditCard || s.paymentMethods?.debitCard ? ["card"] : [],
          prices: [], outages: [],
        };
        by.set(s.id, r);
      }
      for (const p of s.prices ?? []) {
        const fuel = FUELS.find(([k]) => k === p.fuelType)?.[1];
        if (fuel && p.amount > 0.3 && !r.prices.some((x) => x.fuel === fuel)) r.prices.push({ fuel, price: p.amount, updatedAt: fetchedAt });
      }
    }
  }
  return [...by.values()];
}

export const at: Connector = {
  id: "at", country: "AT", name: "E-Control — Spritpreisrechner", currency: "EUR",
  license: "E-Control (données publiques)", attribution: "E-Control Austria — couverture partielle : seules les stations les moins chères sont publiées",
  url: "https://www.spritpreisrechner.at/", schedule: "40 * * * *",
  async fetch() {
    const regions = (await (await fetchWithRetry(`${API}/regions?includeCities=false`)).json()) as { subRegions: { code: number }[] }[];
    const districts = regions.flatMap((r) => r.subRegions.map((s) => s.code));
    const responses: AtStation[][] = [];
    for (const code of districts) {
      for (const [fuelType] of FUELS) {
        const res = await fetchWithRetry(`${API}/search/gas-stations/by-region?${new URLSearchParams({ code: String(code), type: "PB", fuelType, includeClosed: "true" })}`);
        responses.push((await res.json()) as AtStation[]);
      }
    }
    return parseAt(responses);
  },
};
