import type { FuelCode } from "@/lib/fuels";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// MTS-K via l'API Tankerkönig (clé gratuite, CC BY 4.0). L'API ne fait que des recherches par rayon (≤ 25 km) :
// on interroge les zones de DE_ZONES ("lat,lon;lat,lon…"), à espacer d'au moins 5 min (demande de l'opérateur).
// ponytail: zones configurées plutôt que tout le pays (≈ 600 cercles) ; passer au dump CSV historique si besoin national.
const API = "https://creativecommons.tankerkoenig.de/json/list.php";
const FUELS: [string, FuelCode][] = [["diesel", "B7"], ["e5", "E5"], ["e10", "E10"]];

type DeStation = {
  id: string; name?: string; brand?: string; street?: string; houseNumber?: string; postCode?: number | string;
  place?: string; lat: number; lng: number; isOpen?: boolean; diesel?: number | null | false; e5?: number | null | false; e10?: number | null | false;
};

export function parseDe(responses: DeStation[][], fetchedAt = new Date()): RawStation[] {
  const by = new Map<string, RawStation>();
  for (const s of responses.flat()) {
    if (by.has(s.id)) continue;
    by.set(s.id, {
      externalId: s.id, name: s.name?.trim() || null, brand: s.brand?.trim() || null,
      address: [s.street, s.houseNumber].filter(Boolean).join(" ").trim() || null,
      postalCode: s.postCode ? String(s.postCode).padStart(5, "0") : null, city: s.place ?? null,
      lat: s.lat, lon: s.lng, roadType: "unknown", is24hAutomat: false, services: [], paymentMethods: [], outages: [],
      prices: FUELS.flatMap(([k, fuel]) => {
        const v = s[k as "diesel" | "e5" | "e10"];
        return typeof v === "number" && v > 0.3 ? [{ fuel, price: v, updatedAt: fetchedAt }] : [];
      }),
    });
  }
  return [...by.values()];
}

export const zones = () => (process.env.DE_ZONES ?? "").split(";").map((z) => z.split(",").map(Number))
  .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));

export const de: Connector = {
  id: "de", country: "DE", name: "MTS-K via Tankerkönig", currency: "EUR",
  license: "CC BY 4.0", attribution: "Markttransparenzstelle für Kraftstoffe (MTS-K), via Tankerkönig — zones configurées seulement",
  url: "https://creativecommons.tankerkoenig.de/", schedule: "*/15 * * * *",
  async fetch() {
    const key = process.env.TANKERKOENIG_API_KEY;
    if (!key) throw new Error("DE: TANKERKOENIG_API_KEY manquante");
    const responses: DeStation[][] = [];
    for (const [lat, lon] of zones()) {
      const res = await fetchWithRetry(`${API}?${new URLSearchParams({ lat: String(lat), lng: String(lon), rad: "25", sort: "dist", type: "all", apikey: key })}`);
      const j = (await res.json()) as { ok: boolean; stations?: DeStation[]; message?: string };
      if (!j.ok) throw new Error(`DE: ${j.message ?? "refus"}`);
      responses.push(j.stations ?? []);
    }
    return parseDe(responses);
  },
};
