import { sql } from "drizzle-orm";
import { db } from "@/db";

export const PERIODS = [7, 30, 365] as const;

/** Points de prix de la station sur la période, précédés du dernier prix connu avant la période. */
export async function stationSeries(stationId: number, fuel: string, days: number) {
  const rows = (await db.execute(sql`
    (select valid_from, price from price_history
      where station_id = ${stationId} and fuel_code = ${fuel} and valid_from < now() - make_interval(days => ${days})
      order by valid_from desc limit 1)
    union all
    (select valid_from, price from price_history
      where station_id = ${stationId} and fuel_code = ${fuel} and valid_from >= now() - make_interval(days => ${days}))
    order by valid_from
  `)) as unknown as { valid_from: Date; price: string }[];
  return rows.map((r) => [new Date(r.valid_from).getTime(), Number(r.price)] as [number, number]);
}

/** Médiane quotidienne de la zone (10 km) : prix en vigueur chaque jour pour chaque station. */
export async function zoneMedianSeries(stationId: number, fuel: string, days: number) {
  const step = days > 60 ? 7 : 1; // hebdomadaire sur un an : ~52 points
  const rows = (await db.execute(sql`
    with days as (
      select generate_series(date_trunc('day', now()) - make_interval(days => ${days}), date_trunc('day', now()), make_interval(days => ${step})) as d
    ), zone as (
      select s.id from station s0 join station s on ST_DWithin(s.location::geography, s0.location::geography, 10000)
      where s0.id = ${stationId} and s.status in ('active', 'closed_temp')
    ), vals as (
      select d.d, (
        select h.price from price_history h
        where h.station_id = z.id and h.fuel_code = ${fuel} and h.valid_from < d.d + interval '1 day'
          and h.valid_from > d.d - interval '30 days'
        order by h.valid_from desc limit 1
      ) as p
      from days d cross join zone z
    )
    select d, percentile_cont(0.5) within group (order by p) as m from vals where p is not null group by d order by d
  `)) as unknown as { d: Date; m: number }[];
  return rows.map((r) => [new Date(r.d).getTime(), Number(r.m)] as [number, number]);
}

export { priceAt, trendOf, type Trend } from "./trend";
