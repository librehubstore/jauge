import { and, desc, eq, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/db";
import { brand, fillUp, station, stationFuelPrice, vehicle } from "@/db/schema";
import { FillUpForm, FillUpList, LogStatsPanel } from "@/components/FuelLog";
import { logStats } from "@/lib/fuel-log";
import { requireUser } from "@/lib/session";

export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const u = await requireUser();
  const t = await getTranslations("log");
  const sp = await searchParams;
  const vehicles = await db.select().from(vehicle).where(eq(vehicle.userId, u.id)).orderBy(vehicle.id);

  if (!vehicles.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-base text-muted">{t("noVehicle")}</p>
        <Link className="btn-primary" href="/vehicles">{t("addVehicle")}</Link>
      </div>
    );
  }

  const v = vehicles.find((x) => x.id === Number(sp.v)) ?? vehicles.find((x) => x.isDefault) ?? vehicles[0];
  const rows = await db.select({
    f: fillUp, stationLabel: sql<string | null>`coalesce(${brand.name}, ${station.name}, ${station.city})`,
  }).from(fillUp).leftJoin(station, eq(station.id, fillUp.stationId)).leftJoin(brand, eq(brand.id, station.brandId))
    .where(eq(fillUp.vehicleId, v.id)).orderBy(desc(fillUp.filledAt)).limit(500);
  const stats = logStats(rows.map(({ f }) => f));

  // « J'ai fait le plein ici » depuis une fiche station : station et prix préremplis.
  const fromStation = Number(sp.station) || null;
  let prefill: { stationId: number; label: string; price: number | null } | null = null;
  if (fromStation) {
    const [s] = await db.select({ label: sql<string>`coalesce(${brand.name}, ${station.name}, ${station.city}, '')`, price: stationFuelPrice.price })
      .from(station).leftJoin(brand, eq(brand.id, station.brandId))
      .leftJoin(stationFuelPrice, and(eq(stationFuelPrice.stationId, station.id), eq(stationFuelPrice.fuelCode, v.fuelCode)))
      .where(eq(station.id, fromStation));
    if (s) prefill = { stationId: fromStation, label: s.label, price: s.price ?? null };
  }
  const lastOdo = rows.find(({ f }) => f.odometerKm !== null)?.f.odometerKm ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 p-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <a className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-accent md:btn-ghost md:text-fg" href={`/api/log.csv?v=${v.id}`} download>{t("export")}</a>
        </div>
        {vehicles.length > 1 && (
          <nav className="-mx-4 flex gap-2 overflow-x-auto px-4" aria-label={t("vehicle")}>
            {vehicles.map((x) => (
              <Link key={x.id} href={`/log?v=${x.id}`} aria-current={x.id === v.id ? "page" : undefined}
                className={`pill ${x.id === v.id ? "border-accent bg-accent text-accent-fg" : ""}`}>{x.name}</Link>
            ))}
          </nav>
        )}
        <LogStatsPanel stats={stats} vehicleId={v.id} declared={v.consumptionPer100km} unit={v.fuelCode === "CNG" || v.fuelCode === "H2" || v.fuelCode === "LNG" ? "kg" : "L"} />
        <FillUpForm vehicleId={v.id} prefill={prefill} lastOdometer={lastOdo} />
        <FillUpList items={rows.map(({ f, stationLabel }) => ({
          id: f.id, filledAt: f.filledAt.toISOString(), amount: f.amount, totalCost: f.totalCost, currency: f.currency,
          odometerKm: f.odometerKm, fullTank: f.fullTank, stationId: f.stationId, stationLabel, note: f.note,
        }))} />
      </div>
    </div>
  );
}
