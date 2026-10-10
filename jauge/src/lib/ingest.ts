import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { Connector, RawStation } from "@/connectors/types";
import { db } from "@/db";
import { brand, ingestionRun, openingHours, outage, priceHistory, source, station, stationFuelPrice } from "@/db/schema";
import { evaluateAlerts } from "./alerts";
import { median } from "./cost";

const BATCH = 500;
const INACTIVE_DAYS = 30;

/** Médiane par carburant sur le jeu entrant : sert à la détection des prix aberrants. */
function mediansByFuel(rows: RawStation[]) {
  const by = new Map<string, number[]>();
  for (const s of rows) for (const p of s.prices) (by.get(p.fuel) ?? by.set(p.fuel, []).get(p.fuel)!).push(p.price);
  return new Map([...by].map(([f, v]) => [f, median(v)!]));
}

export const isAberrant = (price: number, med: number | undefined) => !!med && (price < med * 0.3 || price > med * 3);

async function brandIds(names: string[]) {
  const uniq = [...new Set(names.filter(Boolean))];
  if (!uniq.length) return new Map<string, number>();
  await db.insert(brand).values(uniq.map((name) => ({ name }))).onConflictDoNothing();
  const rows = await db.select().from(brand).where(inArray(brand.name, uniq));
  return new Map(rows.map((b) => [b.name, b.id]));
}

/** Coordonnées plausibles (certaines sources publient des valeurs inversées ou nulles). */
export const validCoords = (s: RawStation) => Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && !(s.lat === 0 && s.lon === 0);

export async function ingestStations(c: Connector, input: RawStation[]) {
  const rows = input.filter(validCoords);
  const meds = mediansByFuel(rows);
  let stationsUpserted = 0, pricesChanged = 0;
  const now = new Date();

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const brands = await brandIds(batch.map((s) => s.brand ?? ""));

    const upserted = await db.insert(station).values(batch.map((s) => ({
      sourceId: c.id, externalId: s.externalId, country: c.country, name: s.name ?? null,
      brandId: s.brand ? brands.get(s.brand) ?? null : null, brandOrigin: s.brand ? "source" : null,
      address: s.address ?? null, postalCode: s.postalCode ?? null, city: s.city ?? null,
      location: { x: s.lon, y: s.lat }, roadType: s.roadType, is24hAutomat: s.is24hAutomat,
      services: s.services, paymentMethods: s.paymentMethods, status: s.status ?? "active", lastSeenAt: now,
    }))).onConflictDoUpdate({
      target: [station.sourceId, station.externalId],
      set: {
        name: sql`excluded.name`, address: sql`excluded.address`, postalCode: sql`excluded.postal_code`,
        city: sql`excluded.city`, location: sql`excluded.location`, roadType: sql`excluded.road_type`,
        is24hAutomat: sql`excluded.is_24h_automat`, services: sql`excluded.services`,
        paymentMethods: sql`excluded.payment_methods`,
        status: c.keepStatus ? sql`${station.status}` : sql`excluded.status`, lastSeenAt: sql`excluded.last_seen_at`,
        // Enseigne validée par la modération > enseigne de la source > enrichissement OSM existant.
        brandId: sql`case when ${station.brandOrigin} = 'community' then ${station.brandId} else coalesce(excluded.brand_id, ${station.brandId}) end`,
        brandOrigin: sql`case when ${station.brandOrigin} = 'community' then ${station.brandOrigin} else coalesce(excluded.brand_origin, ${station.brandOrigin}) end`,
      },
    }).returning({ id: station.id, externalId: station.externalId });
    stationsUpserted += upserted.length;
    const idOf = new Map(upserted.map((r) => [r.externalId, r.id]));
    const ids = upserted.map((r) => r.id);

    // Horaires et ruptures officielles : remplacés à l'identique (idempotent).
    await db.delete(openingHours).where(inArray(openingHours.stationId, ids));
    const hours = batch.flatMap((s) => (s.hours ?? []).map((h) => ({ stationId: idOf.get(s.externalId)!, ...h })));
    if (hours.length) await db.insert(openingHours).values(hours);

    await db.delete(outage).where(and(inArray(outage.stationId, ids), eq(outage.origin, "official")));
    const outs = batch.flatMap((s) => s.outages.map((o) => ({
      stationId: idOf.get(s.externalId)!, fuelCode: o.fuel, kind: o.kind, startedAt: o.startedAt, origin: "official",
    })));
    if (outs.length) await db.insert(outage).values(outs);

    // Prix : on n'écrit que ce qui change ; un point d'historique seulement si le montant change.
    const current = await db.select().from(stationFuelPrice).where(inArray(stationFuelPrice.stationId, ids));
    const cur = new Map(current.map((p) => [`${p.stationId}|${p.fuelCode}`, p]));
    const upserts: (typeof stationFuelPrice.$inferInsert)[] = [];
    const history: (typeof priceHistory.$inferInsert)[] = [];
    for (const s of batch) {
      const stationId = idOf.get(s.externalId)!;
      for (const p of s.prices) {
        const prev = cur.get(`${stationId}|${p.fuel}`);
        if (prev && prev.origin === "official" && prev.price === p.price && +prev.sourceUpdatedAt === +p.updatedAt) continue;
        // Un prix communautaire plus récent n'est pas écrasé par un prix officiel plus ancien.
        if (prev && prev.origin === "community" && prev.sourceUpdatedAt > p.updatedAt) continue;
        const quarantined = isAberrant(p.price, meds.get(p.fuel));
        upserts.push({
          stationId, fuelCode: p.fuel, price: p.price, currency: c.currency,
          sourceUpdatedAt: p.updatedAt, ingestedAt: now, origin: "official", quarantined,
        });
        if (!quarantined && prev?.price !== p.price) {
          history.push({ stationId, fuelCode: p.fuel, price: p.price, currency: c.currency, validFrom: p.updatedAt });
        }
      }
    }
    if (upserts.length) {
      await db.insert(stationFuelPrice).values(upserts).onConflictDoUpdate({
        target: [stationFuelPrice.stationId, stationFuelPrice.fuelCode],
        set: {
          price: sql`excluded.price`, currency: sql`excluded.currency`, sourceUpdatedAt: sql`excluded.source_updated_at`,
          ingestedAt: sql`excluded.ingested_at`, origin: sql`excluded.origin`, quarantined: sql`excluded.quarantined`,
        },
      });
      pricesChanged += upserts.length;
    }
    if (history.length) await db.insert(priceHistory).values(history).onConflictDoNothing();
  }

  await db.update(station).set({ status: "inactive" }).where(and(
    eq(station.sourceId, c.id),
    lt(station.lastSeenAt, new Date(now.getTime() - INACTIVE_DAYS * 86_400_000)),
  ));
  return { stationsUpserted, pricesChanged };
}

/** Exécute un connecteur avec journalisation (spec 4.2). */
export async function runConnector(c: Connector, fetchRows: () => Promise<RawStation[]> = c.fetch) {
  const [run] = await db.insert(ingestionRun).values({ sourceId: c.id }).returning();
  try {
    const counts = await ingestStations(c, await fetchRows());
    await db.update(ingestionRun).set({ ...counts, status: "success", finishedAt: new Date() }).where(eq(ingestionRun.id, run.id));
    await db.update(source).set({ lastSuccessAt: new Date(), consecutiveFailures: 0 }).where(eq(source.id, c.id));
    if (counts.pricesChanged) await evaluateAlerts().catch((e) => console.error("[alerts]", e));
    return counts;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(ingestionRun).set({ status: "error", error: msg, finishedAt: new Date() }).where(eq(ingestionRun.id, run.id));
    await db.update(source).set({ consecutiveFailures: sql`${source.consecutiveFailures} + 1` }).where(eq(source.id, c.id));
    throw e;
  }
}
