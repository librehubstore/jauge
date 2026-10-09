import { asc, eq, sql } from "drizzle-orm";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/db";
import { brand, contribution, station, stationFuelPrice, user } from "@/db/schema";
import { ModerationActions } from "@/components/ModerationActions";
import { localMedian } from "@/lib/contributions";
import { requireRole } from "@/lib/session";

export default async function ModerationPage() {
  await requireRole("moderator", "admin");
  const t = await getTranslations("moderation");
  const tf = await getTranslations("fuel");
  const tc = await getTranslations("contrib");
  const f = await getFormatter();
  const now = await getNow();

  const items = await db.select({
    c: contribution, author: user.name, email: user.email, reputation: user.reputation,
    stationName: sql<string | null>`coalesce(${brand.name}, ${station.name}, ${station.city})`, address: station.address,
  }).from(contribution)
    .leftJoin(user, eq(user.id, contribution.userId))
    .leftJoin(station, eq(station.id, contribution.stationId))
    .leftJoin(brand, eq(brand.id, station.brandId))
    .where(eq(contribution.status, "pending")).orderBy(asc(contribution.createdAt)).limit(100);

  // Contexte prix : médiane locale et prix actuel, pour juger un écart.
  const ctx = await Promise.all(items.map(async ({ c }) => {
    if (c.type !== "price" || !c.stationId) return null;
    const fuel = (c.payload as { fuel: string }).fuel;
    const [cur] = await db.select().from(stationFuelPrice).where(sql`${stationFuelPrice.stationId} = ${c.stationId} and ${stationFuelPrice.fuelCode} = ${fuel}`);
    return { median: await localMedian(c.stationId, fuel), current: cur?.price ?? null };
  }));

  const money = (v: number) => f.number(v, { style: "currency", currency: "EUR", minimumFractionDigits: 3 });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
        {items.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
        <ul className="space-y-3">
          {items.map(({ c, author, email, reputation, stationName, address }, i) => {
            const p = c.payload as Record<string, string | number>;
            return (
              <li key={c.id} className="card space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{t(`types.${c.type}` as never)}</p>
                  <p className="text-xs text-muted">{f.relativeTime(c.createdAt, now)}</p>
                </div>
                {c.stationId && c.type !== "missing_station"
                  ? <p><Link className="text-accent hover:underline" href={`/station/${c.stationId}`}>{stationName ?? `#${c.stationId}`}</Link> <span className="text-muted">{address}</span></p>
                  : null}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {Object.entries(p).map(([k, v]) => (
                    <Fragment key={k}><dt className="text-muted">{tc.has(k) ? tc(k as never) : k}</dt>
                      <dd className={k === "price" ? "price" : ""}>{k === "fuel" ? tf(String(v) as never) : k === "price" ? money(Number(v)) : String(v)}</dd></Fragment>
                  ))}
                </dl>
                {c.type === "missing_station" && (
                  <a className="text-xs text-accent hover:underline" target="_blank" rel="noopener noreferrer"
                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}`}>OpenStreetMap ↗</a>
                )}
                {ctx[i] && (
                  <p className="text-xs text-muted">
                    {ctx[i]!.median !== null && t("median", { value: money(ctx[i]!.median!) })}
                    {ctx[i]!.current !== null && <> · {t("current", { value: money(ctx[i]!.current!) })}</>}
                  </p>
                )}
                <p className="text-xs text-muted">{t("author")} : {author ?? "—"} ({email}) · {t("reputation", { value: reputation ?? 0 })}</p>
                <ModerationActions id={c.id} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
