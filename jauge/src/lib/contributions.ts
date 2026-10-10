import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { brand, contribution, outage, priceHistory, station, stationFuelPrice, user } from "@/db/schema";
import { evaluateAlerts } from "./alerts";
import { median } from "./cost";
import { FUEL_CODES } from "./fuels";
import { notify } from "./notify";

const fuel = z.enum(FUEL_CODES as [string, ...string[]]);

export const PAYLOADS = {
  outage: z.object({ fuel }),
  price: z.object({ fuel, price: z.coerce.number().min(0.1).max(20) }),
  closed: z.object({ kind: z.enum(["temporary", "permanent"]) }),
  brand_change: z.object({ brand: z.string().trim().min(1).max(60) }),
  hours: z.object({ note: z.string().trim().min(3).max(500) }),
  missing_station: z.object({
    name: z.string().trim().max(80).optional(), brand: z.string().trim().max(60).optional(),
    address: z.string().trim().max(160).optional(), city: z.string().trim().max(80).optional(),
    country: z.string().length(2).toUpperCase(),
    lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180),
  }),
};
export type ContributionType = keyof typeof PAYLOADS;

export const PRICE_DEVIATION = 0.15;
export const LOW_REPUTATION = -5;
const OFFICIAL_PRIORITY_HOURS = 24;

/** Publication immédiate ou passage en modération (spec 4.10). */
export function initialStatus(type: ContributionType, ctx: { reputation: number; price?: number; localMedian?: number | null }) {
  if (ctx.reputation < LOW_REPUTATION) return "pending";
  if (type === "outage") return "published";
  if (type === "price") {
    const m = ctx.localMedian;
    return m && Math.abs(ctx.price! - m) / m > PRICE_DEVIATION ? "pending" : "published";
  }
  return "pending"; // fermeture, enseigne, horaires, nouvelle station : toujours vérifiés
}

/** Médiane des prix récents (< 7 j, hors quarantaine) dans un rayon de 10 km autour de la station. */
export async function localMedian(stationId: number, fuelCode: string) {
  const rows = (await db.execute(sql`
    select p.price from station s0
    join station s on ST_DWithin(s.location::geography, s0.location::geography, 10000)
    join station_fuel_price p on p.station_id = s.id and p.fuel_code = ${fuelCode}
    where s0.id = ${stationId} and not p.quarantined and p.source_updated_at > now() - interval '7 days'
  `)) as unknown as { price: string }[];
  return median(rows.map((r) => Number(r.price)));
}

/** Applique une contribution publiée aux données de référence. */
export async function applyContribution(c: typeof contribution.$inferSelect) {
  const now = new Date();
  switch (c.type as ContributionType) {
    case "outage": {
      const p = PAYLOADS.outage.parse(c.payload);
      await db.insert(outage).values({ stationId: c.stationId!, fuelCode: p.fuel, kind: "temporary", origin: "community", reportedBy: c.userId });
      return;
    }
    case "price": {
      const p = PAYLOADS.price.parse(c.payload);
      const [cur] = await db.select().from(stationFuelPrice)
        .where(and(eq(stationFuelPrice.stationId, c.stationId!), eq(stationFuelPrice.fuelCode, p.fuel)));
      // Un prix officiel de moins de 24 h reste affiché : la contribution est seulement conservée.
      if (cur?.origin === "official" && now.getTime() - cur.sourceUpdatedAt.getTime() < OFFICIAL_PRIORITY_HOURS * 3_600_000) return;
      const [s] = await db.select({ country: station.country }).from(station).where(eq(station.id, c.stationId!));
      const currency = cur?.currency ?? (s?.country === "GB" ? "GBP" : "EUR");
      await db.insert(stationFuelPrice).values({
        stationId: c.stationId!, fuelCode: p.fuel, price: p.price, currency, sourceUpdatedAt: now, ingestedAt: now, origin: "community",
      }).onConflictDoUpdate({
        target: [stationFuelPrice.stationId, stationFuelPrice.fuelCode],
        set: { price: p.price, currency, sourceUpdatedAt: now, ingestedAt: now, origin: "community", quarantined: false },
      });
      await evaluateAlerts().catch((e) => console.error("[alerts]", e));
      if (cur?.price !== p.price) {
        await db.insert(priceHistory).values({ stationId: c.stationId!, fuelCode: p.fuel, price: p.price, currency, validFrom: now }).onConflictDoNothing();
      }
      return;
    }
    case "closed": {
      const p = PAYLOADS.closed.parse(c.payload);
      await db.update(station).set({ status: p.kind === "permanent" ? "closed" : "closed_temp" }).where(eq(station.id, c.stationId!));
      return;
    }
    case "brand_change": {
      const p = PAYLOADS.brand_change.parse(c.payload);
      await db.insert(brand).values({ name: p.brand }).onConflictDoNothing();
      const [b] = await db.select().from(brand).where(eq(brand.name, p.brand));
      await db.update(station).set({ brandId: b.id, brandOrigin: "community" }).where(eq(station.id, c.stationId!));
      return;
    }
    case "hours":
      return; // ponytail: note libre lue par le modérateur ; pas d'éditeur d'horaires structuré
    case "missing_station": {
      const p = PAYLOADS.missing_station.parse(c.payload);
      let brandId: number | null = null;
      if (p.brand) {
        await db.insert(brand).values({ name: p.brand }).onConflictDoNothing();
        brandId = (await db.select().from(brand).where(eq(brand.name, p.brand)))[0].id;
      }
      const [s] = await db.insert(station).values({
        sourceId: "community", externalId: `c${c.id}`, country: p.country, name: p.name || null, brandId,
        brandOrigin: brandId ? "community" : null, address: p.address || null, city: p.city || null,
        location: { x: p.lon, y: p.lat },
      }).onConflictDoNothing().returning({ id: station.id });
      if (s) await db.update(contribution).set({ stationId: s.id }).where(eq(contribution.id, c.id));
      return;
    }
  }
}

/** Crée une contribution, la publie si les règles le permettent (spec 4.10). */
export async function submitContribution(userId: string, stationId: number | null, type: ContributionType, raw: unknown) {
  const payload = PAYLOADS[type].parse(raw);
  if (type !== "missing_station" && !stationId) throw new Error("STATION_REQUIRED");
  const [u] = await db.select({ reputation: user.reputation }).from(user).where(eq(user.id, userId));
  const med = type === "price" ? await localMedian(stationId!, (payload as { fuel: string }).fuel) : null;
  const status = initialStatus(type, { reputation: u?.reputation ?? 0, price: (payload as { price?: number }).price, localMedian: med });
  const [c] = await db.insert(contribution).values({ userId, stationId, type, payload, status }).returning();
  if (status === "published") {
    await applyContribution(c);
    await db.update(user).set({ reputation: sql`${user.reputation} + 1` }).where(eq(user.id, userId));
  }
  return c;
}

export async function moderate(id: number, moderatorId: string, decision: "approve" | "reject", reason?: string) {
  const [c] = await db.select().from(contribution).where(and(eq(contribution.id, id), eq(contribution.status, "pending")));
  if (!c) return null;
  const status = decision === "approve" ? "published" : "rejected";
  if (decision === "approve") await applyContribution(c);
  await db.update(contribution).set({ status, moderatorId, reason: reason ?? null }).where(eq(contribution.id, id));
  if (c.userId) {
    await db.update(user).set({ reputation: sql`${user.reputation} + ${decision === "approve" ? 1 : -3}` }).where(eq(user.id, c.userId));
    await notify(c.userId, decision === "approve" ? "contribution_approved" : "contribution_rejected", { reason: reason ?? "" });
  }
  return status;
}
