import { and, desc, eq, sql } from "drizzle-orm";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/db";
import { brand, priceAlert, station, vehicle } from "@/db/schema";
import { AlertActions, NewAlertForm } from "@/components/AlertForms";
import { requireUser } from "@/lib/session";

export default async function AlertsPage() {
  const u = await requireUser();
  const t = await getTranslations("alerts");
  const tf = await getTranslations("fuel");
  const f = await getFormatter();
  const now = await getNow();
  const [v] = await db.select().from(vehicle).where(and(eq(vehicle.userId, u.id), eq(vehicle.isDefault, true)));
  const alerts = await db.select({
    a: priceAlert, stationLabel: sql<string | null>`coalesce(${brand.name}, ${station.name}, ${station.city})`,
  }).from(priceAlert).leftJoin(station, eq(station.id, priceAlert.stationId)).leftJoin(brand, eq(brand.id, station.brandId))
    .where(eq(priceAlert.userId, u.id)).orderBy(desc(priceAlert.createdAt));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {alerts.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
        <ul className="space-y-2">
          {alerts.map(({ a, stationLabel }) => (
            <li key={a.id} className={`card flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${a.active ? "" : "opacity-60"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {tf(a.fuelCode as never)} &lt; <span className="price">{f.number(a.threshold, { minimumFractionDigits: 3 })}</span>
                </p>
                <p className="text-xs text-muted">
                  {a.scope === "station" ? <Link className="text-accent hover:underline" href={`/station/${a.stationId}`}>{stationLabel ?? `#${a.stationId}`}</Link>
                    : a.scope === "favorites" ? t("scopeFavorites") : t("scopeArea", { label: a.label ?? "", km: a.radiusKm ?? 0 })}
                  {" · "}{a.lastTriggeredAt ? t("lastTriggered", { ago: f.relativeTime(a.lastTriggeredAt, now) }) : t("neverTriggered")}
                </p>
              </div>
              <AlertActions id={a.id} active={a.active} />
            </li>
          ))}
        </ul>
        <NewAlertForm defaultFuel={v?.fuelCode ?? u.preferences.defaultFuel ?? "B7"} />
        <p className="text-xs text-muted">{t(u.preferences.emailAlerts ? "emailOn" : "emailOff")} <Link className="text-accent hover:underline" href="/settings">{t("settingsLink")}</Link></p>
      </div>
    </div>
  );
}
