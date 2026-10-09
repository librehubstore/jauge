import type { FuelCode } from "@/lib/fuels";

export type RawPrice = { fuel: FuelCode; price: number; updatedAt: Date };
export type RawOutage = { fuel: FuelCode; kind: "temporary" | "permanent"; startedAt: Date };
export type RawHours = { weekday: number; opens: string | null; closes: string | null; isClosed: boolean };

export type RawStation = {
  externalId: string;
  name?: string | null;
  brand?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  lat: number;
  lon: number;
  roadType: "road" | "motorway" | "unknown";
  is24hAutomat: boolean;
  services: string[];
  paymentMethods: string[];
  hours?: RawHours[];
  prices: RawPrice[];
  outages: RawOutage[];
  status?: "active" | "closed_temp" | "closed";
};

export type Connector = {
  id: string;
  country: string;
  name: string;
  currency: string;
  license: string;
  attribution: string;
  url: string;
  schedule: string; // cron
  kind?: "official" | "community";
  /** Ne pas écraser le statut existant (fermetures validées par la modération). */
  keepStatus?: boolean;
  fetch: () => Promise<RawStation[]>;
};

export async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(120_000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Jauge/1.0)", ...init.headers },
      });
      if (res.ok) return res;
      last = new Error(`HTTP ${res.status} ${url}`);
    } catch (e) {
      last = e;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  throw last;
}
