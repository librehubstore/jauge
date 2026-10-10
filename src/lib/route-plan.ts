import { sql } from "drizzle-orm";
import { db } from "@/db";
import { EXCLUDED_DAYS, median, ROAD_FACTOR } from "./cost";
import { planFuel, type Candidate, type Plan, type Strategy } from "./fuel-plan";
import { route, type LatLon } from "./routing";

export type RoutePlanInput = {
  points: LatLon[]; avoidTolls: boolean; avoidHighways: boolean; corridorKm: number;
  fuel: string; tank: number; consumption: number; startLevel: number; reserve: number; maxAgeDays?: number;
};

export type RouteStation = Candidate & { label: string | null; address: string | null; city: string | null; lat: number; lon: number; currency: string };

/** Réduit le tracé à ~1 500 points pour la requête spatiale (précision largement suffisante pour un corridor ≥ 1 km). */
function downsample(coords: [number, number][], max = 1500) {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[Math.floor(i)]);
  out.push(coords[coords.length - 1]);
  return out;
}

export async function planRoute(input: RoutePlanInput) {
  const r = await route(input.points, { avoidTolls: input.avoidTolls, avoidHighways: input.avoidHighways });
  const wkt = `LINESTRING(${downsample(r.coords).map(([lon, lat]) => `${lon} ${lat}`).join(",")})`;
  const rows = (await db.execute(sql`
    with line as (select ST_SetSRID(ST_GeomFromText(${wkt}), 4326) as g)
    select s.id, coalesce(b.name, s.name, s.city) as label, s.address, s.city,
      ST_Y(s.location) as lat, ST_X(s.location) as lon,
      ST_LineLocatePoint(line.g, s.location) as frac,
      ST_Distance(s.location::geography, line.g::geography) as off_m,
      p.price, p.currency
    from station s
    join line on ST_DWithin(s.location::geography, line.g::geography, ${input.corridorKm * 1000})
    join station_fuel_price p on p.station_id = s.id and p.fuel_code = ${input.fuel}
      and not p.quarantined and p.source_updated_at > now() - make_interval(days => ${input.maxAgeDays ?? EXCLUDED_DAYS})
    left join brand b on b.id = s.brand_id
    where s.status = 'active'
      and not exists (
        select 1 from outage o where o.station_id = s.id and o.fuel_code = ${input.fuel} and o.ended_at is null
          and (o.origin = 'official' or (o.started_at > now() - interval '12 hours' and p.source_updated_at < o.started_at))
      )
  `)) as unknown as { id: number; label: string | null; address: string | null; city: string | null; lat: number; lon: number; frac: number; off_m: number; price: string; currency: string }[];

  const stations: RouteStation[] = rows.map((s) => ({
    id: s.id, label: s.label, address: s.address, city: s.city, lat: Number(s.lat), lon: Number(s.lon), currency: s.currency,
    km: Number(s.frac) * r.km, price: Number(s.price),
    detourKm: (Number(s.off_m) / 1000) * ROAD_FACTOR * 2, // aller-retour estimé depuis le tracé
  }));

  const params = { routeKm: r.km, tank: input.tank, consumption: input.consumption, startLevel: input.startLevel, reserve: input.reserve };
  const med = median(stations.map((s) => s.price));
  const raw = Object.fromEntries((["cheapest", "balanced", "fewest"] as Strategy[]).map((st) => [st, planFuel(st, params, stations)])) as Record<Strategy, Plan | null>;
  // Économie par rapport à la stratégie naïve (s'arrêter le plus tard possible), au même volume acheté.
  const naive = raw.fewest && raw.fewest.amount > 0 ? raw.fewest.fuelCost / raw.fewest.amount : null;
  const plans = Object.fromEntries(Object.entries(raw).map(([st, plan]) => [st, plan && {
    ...plan, saving: naive !== null ? plan.amount * naive - plan.fuelCost : null,
  }])) as Record<Strategy, (Plan & { saving: number | null }) | null>;

  const byId = new Map(stations.map((s) => [s.id, s]));
  return {
    route: { coords: downsample(r.coords, 3000), km: r.km, minutes: r.minutes },
    median: med,
    candidates: stations.length,
    plans: Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, p && {
      ...p, stops: p.stops.map((s) => ({ ...byId.get(s.id)!, ...s })),
    }])) as Record<Strategy, ((Plan & { saving: number | null; stops: (RouteStation & Plan["stops"][number])[] }) | null)>,
  };
}
