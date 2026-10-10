import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { brand, fillUp, station, vehicle } from "@/db/schema";
import { csvCell } from "@/lib/fuel-log";
import { currentUser } from "@/lib/session";

/** Export CSV du journal de pleins d'un véhicule (séparateur « ; », BOM pour Excel). */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("UNAUTHORIZED", { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("v"));
  const [v] = await db.select().from(vehicle).where(and(eq(vehicle.id, id), eq(vehicle.userId, u.id)));
  if (!v) return new Response("NOT_FOUND", { status: 404 });
  const rows = await db.select({ f: fillUp, label: sql<string | null>`coalesce(${brand.name}, ${station.name}, ${station.city})` })
    .from(fillUp).leftJoin(station, eq(station.id, fillUp.stationId)).leftJoin(brand, eq(brand.id, station.brandId))
    .where(eq(fillUp.vehicleId, v.id)).orderBy(asc(fillUp.filledAt));
  const header = ["date", "fuel", "amount", "unit_price", "total_cost", "currency", "odometer_km", "full_tank", "station", "note"];
  const lines = rows.map(({ f, label }) => [
    f.filledAt.toISOString(), f.fuelCode, f.amount, (f.totalCost / f.amount).toFixed(3), f.totalCost.toFixed(2), f.currency,
    f.odometerKm, f.fullTank ? "1" : "0", label, f.note,
  ].map(csvCell).join(";"));
  const name = `jauge-${v.name.replace(/[^\w-]+/g, "_")}.csv`;
  return new Response("﻿" + [header.join(";"), ...lines].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"` },
  });
}
