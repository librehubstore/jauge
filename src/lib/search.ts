import { sql } from "drizzle-orm";
import { db } from "@/db";
import { amountToAdd, bestChoiceCost, detourCost, detourKm, freshness, median, priceTiers, savings, type Freshness } from "./cost";
import { isOpenAt, type Hours } from "./hours";
import { roadDistances } from "./routing";

export type SortKey = "best" | "price" | "fill" | "distance";

export type SearchParams = {
  lat: number; lon: number; radiusKm: number; fuel: string;
  sort: SortKey; level: number; tank: number; consumption: number;
  onlySelling: boolean; hideOutages: boolean; openNow: boolean; automat24: boolean; includeOld: boolean;
  brands: number[]; excludeBrands: number[]; services: string[];
  favoritesFirst: boolean; userId: string;
};

export type StationResult = {
  id: number; name: string | null; brandId: number | null; brand: string | null; brandOrigin: string | null; address: string | null;
  city: string | null; country: string; lat: number; lon: number; distanceKm: number; status: string;
  is24hAutomat: boolean; services: string[]; favorite: boolean;
  price: number | null; currency: string | null; priceUpdatedAt: string | null; origin: string | null;
  freshness: Freshness | null; outage: boolean; openNow: boolean | null;
  tier: 0 | 1 | 2 | null; fillCost: number | null; detourKm: number; detourCost: number | null;
  detourEstimated: boolean; detourMinutes: number | null;
  totalCost: number | null; saving: number | null;
};

const COMMUNITY_OUTAGE_HOURS = 12;

type Row = {
  id: number; name: string | null; brand: string | null; brand_origin: string | null; address: string | null;
  city: string | null; country: string; lat: number; lon: number; distance_km: number; status: string;
  is_24h_automat: boolean; services: string[]; brand_id: number | null; favorite: boolean;
  price: string | null; currency: string | null; source_updated_at: Date | null; origin: string | null;
  quarantined: boolean | null; outage: boolean; hours: Hours | null;
};

export async function searchStations(p: SearchParams): Promise<{ stations: StationResult[]; median: number | null }> {
  const radiusM = Math.min(50, Math.max(1, p.radiusKm)) * 1000;
  const rows = (await db.execute(sql`
    select s.id, s.name, b.name as brand, s.brand_origin, s.address, s.city, s.country, s.status,
      ST_Y(s.location) as lat, ST_X(s.location) as lon, s.is_24h_automat, s.services, s.brand_id,
      ST_Distance(s.location::geography, ST_MakePoint(${p.lon}, ${p.lat})::geography) / 1000 as distance_km,
      exists(select 1 from favorite f where f.station_id = s.id and f.user_id = ${p.userId}) as favorite,
      pr.price, pr.currency, pr.source_updated_at, pr.origin, pr.quarantined,
      exists(
        select 1 from outage o where o.station_id = s.id and o.fuel_code = ${p.fuel} and o.ended_at is null and (
          o.origin = 'official' or (
            o.started_at > now() - make_interval(hours => ${COMMUNITY_OUTAGE_HOURS})
            and (pr.source_updated_at is null or pr.source_updated_at < o.started_at)
          )
        )
      ) as outage,
      (select json_agg(json_build_array(h.weekday, h.opens, h.closes, h.is_closed)) from opening_hours h where h.station_id = s.id) as hours
    from station s
    left join brand b on b.id = s.brand_id
    left join station_fuel_price pr on pr.station_id = s.id and pr.fuel_code = ${p.fuel}
    where ST_DWithin(s.location::geography, ST_MakePoint(${p.lon}, ${p.lat})::geography, ${radiusM})
      and s.status in ('active', 'closed_temp')
    order by distance_km
    limit 500
  `)) as unknown as Row[];
  const result = rank(rows, p, new Date());
  if (p.sort === "best" || p.sort === "fill") await refineDetours(result.stations, p, result.median);
  return result;
}

/** Post-traitement pur : filtres, coûts, tiers, tri (testé unitairement). */
export function rank(rows: Row[], p: SearchParams, now: Date) {
  const amount = amountToAdd(p.tank, p.level);
  const enriched = rows.map((r) => {
    const price = r.price !== null && !r.quarantined ? Number(r.price) : null;
    const fresh = price !== null && r.source_updated_at ? freshness(new Date(r.source_updated_at), now) : null;
    const openNow = r.is_24h_automat ? true : r.hours?.length ? isOpenAt(r.hours, r.country, now) : null;
    return { r, price, fresh, openNow };
  });

  const usable = (x: (typeof enriched)[number]) => x.price !== null && (p.includeOld || x.fresh !== "excluded");
  const filtered = enriched.filter((x) => {
    if (p.onlySelling && !usable(x)) return false;
    if (p.hideOutages && x.r.outage) return false;
    if (p.openNow && x.openNow === false) return false;
    if (p.automat24 && !x.r.is_24h_automat) return false;
    if (p.brands.length && !p.brands.includes(x.r.brand_id ?? -1)) return false;
    if (p.excludeBrands.length && p.excludeBrands.includes(x.r.brand_id ?? -1)) return false;
    if (p.services.length && !p.services.every((s) => x.r.services.includes(s))) return false;
    return true;
  });

  // Tiers et médiane sur les prix non exclus (< 7 j) : certaines sources ne datent un prix que de son dernier changement.
  const freshPrices = filtered.filter((x) => usable(x) && x.fresh !== "excluded" && !x.r.outage).map((x) => x.price!);
  const med = median(freshPrices);
  const tierOf = freshPrices.length ? priceTiers(freshPrices) : null;

  const stations: StationResult[] = filtered.map(({ r, price, fresh, openNow }) => {
    const ranked = price !== null && usable({ r, price, fresh, openNow }) && !r.outage;
    return {
      id: r.id, name: r.name, brandId: r.brand_id, brand: r.brand, brandOrigin: r.brand_origin, address: r.address, city: r.city,
      country: r.country, lat: Number(r.lat), lon: Number(r.lon), distanceKm: Number(r.distance_km), status: r.status,
      is24hAutomat: r.is_24h_automat, services: r.services, favorite: r.favorite,
      price, currency: r.currency, priceUpdatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
      origin: r.origin, freshness: fresh, outage: r.outage, openNow,
      tier: ranked && fresh !== "excluded" && tierOf ? (tierOf(price!) as 0 | 1 | 2) : null,
      fillCost: ranked ? price! * amount : null,
      detourKm: detourKm(Number(r.distance_km)), detourEstimated: true, detourMinutes: null,
      detourCost: ranked ? detourCost(Number(r.distance_km), p.consumption, price!) : null,
      totalCost: ranked ? bestChoiceCost(price!, amount, Number(r.distance_km), p.consumption) : null,
      saving: ranked && med !== null ? savings(med, price!, amount, Number(r.distance_km), p.consumption) : null,
    };
  });

  sortStations(stations, p);
  return { stations, median: med };
}

// Les stations sans prix exploitable passent toujours après celles qui en ont un.
function sortStations(stations: StationResult[], p: Pick<SearchParams, "sort" | "favoritesFirst">) {
  const key = (s: StationResult) => p.sort === "distance" ? s.distanceKm
    : s.totalCost === null ? Infinity
    : p.sort === "price" ? s.price! : p.sort === "fill" ? s.fillCost! : s.totalCost;
  stations.sort((a, b) =>
    (p.favoritesFirst ? Number(b.favorite) - Number(a.favorite) : 0) || key(a) - key(b) || a.distanceKm - b.distanceKm);
}

export const REAL_DETOUR_TOP = 25;

/** Remplace le détour estimé par la distance routière réelle (aller-retour) pour les premières stations, puis re-trie. */
export async function refineDetours(stations: StationResult[], p: SearchParams, med: number | null) {
  const top = stations.filter((s) => s.totalCost !== null).slice(0, REAL_DETOUR_TOP);
  const d = await roadDistances({ lat: p.lat, lon: p.lon }, top.map((s) => ({ lat: s.lat, lon: s.lon })));
  if (!d) return stations;
  const amount = amountToAdd(p.tank, p.level);
  top.forEach((s, i) => {
    if (!Number.isFinite(d[i].km)) return;
    s.detourKm = d[i].km * 2;
    s.detourMinutes = Math.round(d[i].minutes * 2);
    s.detourEstimated = false;
    s.detourCost = (s.detourKm * p.consumption / 100) * s.price!;
    s.totalCost = s.price! * amount + s.detourCost;
    if (med !== null) s.saving = (med - s.price!) * amount - s.detourCost;
  });
  sortStations(stations, p);
  return stations;
}
