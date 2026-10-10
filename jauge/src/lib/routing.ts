// Routage via Valhalla (instance publique FOSSGIS par défaut ; VALHALLA_URL pour un serveur auto-hébergé).
const VALHALLA = process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de";

export type LatLon = { lat: number; lon: number };
export type Route = { coords: [number, number][]; km: number; minutes: number }; // coords : [lon, lat]

/** Décode une polyligne encodée (précision 6 pour Valhalla). */
export function decodePolyline(str: string, precision = 6): [number, number][] {
  const f = 10 ** precision;
  const out: [number, number][] = [];
  let i = 0, lat = 0, lon = 0;
  const next = () => {
    let result = 0, shift = 0, b: number;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lon / f, lat / f]);
  }
  return out;
}

export async function route(points: LatLon[], opts: { avoidTolls?: boolean; avoidHighways?: boolean } = {}): Promise<Route> {
  const res = await fetch(`${VALHALLA}/route`, {
    method: "POST",
    headers: { "content-type": "application/json", "User-Agent": "Jauge/1.0 (internal fuel price tool)" },
    body: JSON.stringify({
      locations: points.map((p) => ({ lat: p.lat, lon: p.lon })),
      costing: "auto",
      costing_options: { auto: { use_tolls: opts.avoidTolls ? 0 : 0.5, use_highways: opts.avoidHighways ? 0 : 1 } },
      units: "kilometers",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ROUTING_FAILED ${res.status}`);
  const j = (await res.json()) as { trip: { summary: { length: number; time: number }; legs: { shape: string }[] } };
  return {
    coords: j.trip.legs.flatMap((l) => decodePolyline(l.shape)),
    km: j.trip.summary.length,
    minutes: Math.round(j.trip.summary.time / 60),
  };
}

/** Distances et durées routières depuis un point vers plusieurs cibles (matrice Valhalla), ou null si indisponible. */
export async function roadDistances(origin: LatLon, targets: LatLon[]): Promise<{ km: number; minutes: number }[] | null> {
  if (!targets.length) return [];
  try {
    const res = await fetch(`${VALHALLA}/sources_to_targets`, {
      method: "POST",
      headers: { "content-type": "application/json", "User-Agent": "Jauge/1.0 (internal fuel price tool)" },
      body: JSON.stringify({ sources: [origin], targets, costing: "auto", units: "kilometers" }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { sources_to_targets: { distance: number | null; time: number | null }[][] };
    return j.sources_to_targets[0].map((c) => ({ km: c.distance ?? NaN, minutes: (c.time ?? NaN) / 60 }));
  } catch {
    return null;
  }
}
