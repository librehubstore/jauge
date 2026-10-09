import { fetchWithRetry, type Connector, type RawStation } from "./types";

type OsmEl = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const yes = (v?: string) => !!v && v !== "no";

/** Stations OSM d'un pays sans open data des prix : les prix viennent des contributions. */
export function parseOsmStations(elements: OsmEl[]): RawStation[] {
  return elements.flatMap((e) => {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (!lat || !lon || t["disused:amenity"]) return [];
    const services = [
      yes(t.compressed_air) && "inflation", yes(t.car_wash) && "wash", yes(t.shop) && "shop",
      yes(t.toilets) && "toilets", yes(t["fuel:adblue"]) && "adblue",
    ].filter((s): s is string => !!s);
    return [{
      externalId: `${e.type}/${e.id}`, name: t.name ?? null, brand: t.brand ?? null,
      address: [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ") || null,
      postalCode: t["addr:postcode"] ?? null, city: t["addr:city"] ?? null, lat, lon,
      roadType: t.highway === "services" ? "motorway" : "unknown",
      is24hAutomat: t.opening_hours === "24/7", services, paymentMethods: [], prices: [], outages: [],
    }];
  });
}

function osmCountry(id: string, country: string, name: string): Connector {
  return {
    id, country, name: `OpenStreetMap — ${name}`, currency: "EUR", kind: "community", keepStatus: true,
    license: "ODbL 1.0", attribution: "© contributeurs OpenStreetMap ; prix saisis par la communauté",
    url: "https://www.openstreetmap.org/copyright", schedule: "0 5 * * 1",
    async fetch() {
      const q = `[out:json][timeout:180];area["ISO3166-1"="${country}"][admin_level=2]->.a;nwr["amenity"="fuel"](area.a);out center tags;`;
      const res = await fetchWithRetry("https://overpass-api.de/api/interpreter", {
        method: "POST", body: new URLSearchParams({ data: q }), headers: { "User-Agent": "Jauge/1.0 (internal fuel price tool)" },
      });
      return parseOsmStations(((await res.json()) as { elements: OsmEl[] }).elements);
    },
  };
}

// Pays sans base publique des prix à la pompe (spec 4.2).
export const be = osmCountry("be", "BE", "Belgique");
export const lu = osmCountry("lu", "LU", "Luxembourg");
export const mc = osmCountry("mc", "MC", "Monaco");
