import { sql } from "drizzle-orm";
import { db } from "@/db";
import { brand } from "@/db/schema";
import { fetchWithRetry } from "./types";

type OsmEl = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> };

/**
 * Enseignes et noms des stations FR (flux officiel sans enseigne) depuis OpenStreetMap (ODbL) :
 * rapprochement exact via ref:FR:prix-carburants, sinon par proximité (< 50 m).
 * N'écrase jamais une enseigne fournie par la source ou par la communauté.
 */
export async function enrichFrBrandsFromOsm(elements?: OsmEl[]) {
  if (!elements) {
    const q = `[out:json][timeout:180];area["ISO3166-1"="FR"][admin_level=2]->.a;nwr["amenity"="fuel"](area.a);out center tags;`;
    const res = await fetchWithRetry("https://overpass-api.de/api/interpreter", {
      method: "POST", body: new URLSearchParams({ data: q }),
      headers: { "User-Agent": "Jauge/1.0 (internal fuel price tool)" },
    });
    elements = ((await res.json()) as { elements: OsmEl[] }).elements;
  }
  const pts = elements.flatMap((e) => {
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const b = e.tags.brand ?? null, name = e.tags.name ?? null;
    return lat && lon && (b || name) ? [{ lat, lon, ref: e.tags["ref:FR:prix-carburants"] ?? null, brand: b, name }] : [];
  });

  const names = [...new Set(pts.map((p) => p.brand).filter((b): b is string => !!b))];
  for (let i = 0; i < names.length; i += 500) {
    await db.insert(brand).values(names.slice(i, i + 500).map((name) => ({ name }))).onConflictDoNothing();
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`create temp table osm_fuel (ref text, brand text, name text, geom geometry(Point, 4326)) on commit drop`);
    for (let i = 0; i < pts.length; i += 1000) {
      const chunk = pts.slice(i, i + 1000);
      await tx.execute(sql`insert into osm_fuel (ref, brand, name, geom) values ${sql.join(
        chunk.map((p) => sql`(${p.ref}, ${p.brand}, ${p.name}, ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326))`), sql`, `)}`);
    }
    // 1) identifiant exact
    const exact = await tx.execute(sql`
      update station s set brand_id = b.id, brand_origin = 'osm', name = coalesce(s.name, o.name)
      from osm_fuel o left join brand b on b.name = o.brand
      where s.source_id = 'fr' and o.ref = s.external_id and (s.brand_origin is null or s.brand_origin = 'osm')`);
    // 2) plus proche à moins de 50 m pour les stations encore sans enseigne
    const near = await tx.execute(sql`
      update station s set brand_id = m.brand_id, brand_origin = 'osm', name = coalesce(s.name, m.name)
      from (
        select s2.id, b.id as brand_id, o.name from station s2
        cross join lateral (
          select o.brand, o.name from osm_fuel o
          where ST_DWithin(o.geom::geography, s2.location::geography, 50)
          order by o.geom <-> s2.location limit 1
        ) o left join brand b on b.name = o.brand
        where s2.source_id = 'fr' and s2.brand_origin is null
      ) m where s.id = m.id`);
    return { osm: pts.length, exact: exact.count, near: near.count };
  });
}
