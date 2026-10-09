import { currentUser } from "@/lib/session";

// Géocodage via Photon (OSM). ponytail: instance publique komoot ; auto-héberger Photon via PHOTON_URL en production.
const PHOTON = process.env.PHOTON_URL ?? "https://photon.komoot.io";

export async function GET(req: Request) {
  if (!(await currentUser())) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return Response.json([]);
  const lang = ["fr", "en", "de", "it"].includes(url.searchParams.get("lang") ?? "") ? url.searchParams.get("lang") : "default";
  const res = await fetch(`${PHOTON}/api/?${new URLSearchParams({ q, limit: "6", lang: lang!, layer: "city" })}&layer=street&layer=house&layer=locality&layer=district`, {
    headers: { "User-Agent": "Jauge/1.0" }, signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return Response.json([], { status: 502 });
  const data = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
  return Response.json(data.features.map((f) => {
    const p = f.properties;
    const label = [p.name ?? [p.housenumber, p.street].filter(Boolean).join(" "), p.postcode, p.city !== p.name ? p.city : null, p.country]
      .filter(Boolean).join(", ");
    return { label, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
  }));
}
