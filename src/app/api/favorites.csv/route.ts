import { sql } from "drizzle-orm";
import { db } from "@/db";
import { csvResponse } from "@/lib/fuel-log";
import { currentUser } from "@/lib/session";

/** Export CSV des favoris : une ligne par station et carburant, avec le prix du jour. */
export async function GET() {
  const u = await currentUser();
  if (!u) return new Response("UNAUTHORIZED", { status: 401 });
  const rows = (await db.execute(sql`
    select s.id, coalesce(b.name, s.name) as label, s.address, s.city, s.country, ST_Y(s.location) as lat, ST_X(s.location) as lon,
      p.fuel_code, p.price, p.currency, p.source_updated_at, p.origin
    from favorite f
    join station s on s.id = f.station_id
    left join brand b on b.id = s.brand_id
    left join station_fuel_price p on p.station_id = s.id and not p.quarantined
    where f.user_id = ${u.id}
    order by f.created_at desc, p.fuel_code
  `)) as unknown as {
    id: number; label: string | null; address: string | null; city: string | null; country: string; lat: number; lon: number;
    fuel_code: string | null; price: string | null; currency: string | null; source_updated_at: Date | null; origin: string | null;
  }[];
  return csvResponse("jauge-favoris.csv",
    ["station_id", "station", "address", "city", "country", "lat", "lon", "fuel", "price", "currency", "updated_at", "origin"],
    rows.map((r) => [r.id, r.label, r.address, r.city, r.country, r.lat, r.lon, r.fuel_code, r.price, r.currency,
      r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null, r.origin]));
}
