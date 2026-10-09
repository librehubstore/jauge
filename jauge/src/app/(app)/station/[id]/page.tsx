import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { brand, favorite, fuelType, openingHours, outage, source, station, stationFuelPrice } from "@/db/schema";
import { ContributionPanel, FavoriteButton } from "@/components/StationActions";
import { freshness } from "@/lib/cost";
import { isOpenAt, localNow, type Hours } from "@/lib/hours";
import { requireUser } from "@/lib/session";

export default async function StationPage({ params }: PageProps<"/station/[id]">) {
  const u = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [s] = await db.select({ st: station, brand: brand.name, src: source })
    .from(station).leftJoin(brand, eq(brand.id, station.brandId)).innerJoin(source, eq(source.id, station.sourceId))
    .where(eq(station.id, id));
  if (!s) notFound();

  const [prices, hours, outs, fav] = await Promise.all([
    db.select({ p: stationFuelPrice, unit: fuelType.unit }).from(stationFuelPrice)
      .innerJoin(fuelType, eq(fuelType.code, stationFuelPrice.fuelCode))
      .where(and(eq(stationFuelPrice.stationId, id), eq(stationFuelPrice.quarantined, false))).orderBy(fuelType.sort),
    db.select().from(openingHours).where(eq(openingHours.stationId, id)).orderBy(openingHours.weekday),
    db.select().from(outage).where(and(eq(outage.stationId, id), isNull(outage.endedAt), or(
      eq(outage.origin, "official"), gt(outage.startedAt, sql`now() - interval '12 hours'`),
    ))),
    db.select().from(favorite).where(and(eq(favorite.userId, u.id), eq(favorite.stationId, id))),
  ]);

  const t = await getTranslations("station");
  const tf = await getTranslations("fuel");
  const tp = await getTranslations("price");
  const ts = await getTranslations("service");
  const tn = await getTranslations("nav_apps");
  const f = await getFormatter();
  const now = await getNow();
  const { st } = s;
  const lat = st.location.y, lon = st.location.x;

  // Une rupture communautaire est levée dès qu'un prix officiel plus récent existe.
  const priceAt = new Map(prices.map(({ p }) => [p.fuelCode, p.sourceUpdatedAt]));
  const activeOutages = outs.filter((o) => o.origin === "official" || !(priceAt.get(o.fuelCode)! > o.startedAt));
  const outageOf = new Map(activeOutages.map((o) => [o.fuelCode, o]));

  const h: Hours = hours.map((x) => [x.weekday, x.opens, x.closes, x.isClosed]);
  const openNow = st.is24hAutomat ? true : h.length ? isOpenAt(h, st.country, now) : null;
  const today = h.find((x) => x[0] === localNow(st.country, now).weekday);
  const statusText = st.is24hAutomat ? t("open24")
    : openNow === true && today?.[2] && today[1] !== today[2] ? t("openUntil", { time: today[2] })
    : openNow === false ? (today?.[1] && !today[3] && localNow(st.country, now).hhmm < today[1] ? t("opensAt", { time: today[1] }) : t("closedNow"))
    : openNow === true ? t("open24") : t("hoursUnknown");

  const navApp = u.preferences.navApp ?? "google";
  const nav = {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    apple: `https://maps.apple.com/?daddr=${lat},${lon}`,
    waze: `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`,
    osm: `https://www.openstreetmap.org/directions?route=%3B${lat}%2C${lon}`,
  };
  const days = t.raw("days") as string[];

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-2xl space-y-5 p-4 pb-16">
        {st.status === "closed" && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{t("closedBanner")}</p>}
        {st.status === "closed_temp" && <p role="alert" className="rounded-md bg-tier-1/10 px-3 py-2 text-sm">{t("closedTempBanner")}</p>}

        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{s.brand ?? st.name ?? t("title")}</h1>
            {s.brand && st.name && st.name !== s.brand && <p className="text-sm text-muted">{st.name}</p>}
            {st.brandOrigin === "osm" && <p className="text-xs text-muted">{t("brandOsm")}</p>}
            <p className="mt-1 text-sm">{[st.address, [st.postalCode, st.city].filter(Boolean).join(" "), st.country].filter(Boolean).join(", ")}</p>
            <p className="mt-1 text-sm">
              <span className={openNow === false ? "text-danger" : openNow ? "text-tier-0" : "text-muted"}>{statusText}</span>
              {st.roadType !== "unknown" && <span className="text-muted"> · {t(st.roadType)}</span>}
            </p>
          </div>
          <FavoriteButton stationId={id} initial={fav.length > 0} labels={{ on: t("unfavorite"), off: t("favorite") }} />
        </header>

        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={nav[navApp]} target="_blank" rel="noopener noreferrer">{t("go")} · {tn(navApp)}</a>
          {(Object.keys(nav) as (keyof typeof nav)[]).filter((k) => k !== navApp).map((k) => (
            <a key={k} className="btn-ghost" href={nav[k]} target="_blank" rel="noopener noreferrer">{tn(k)}</a>
          ))}
        </div>

        <section className="card">
          <h2 className="border-b border-border px-4 py-2.5 font-semibold">{t("prices")}</h2>
          {prices.length === 0 ? <p className="px-4 py-3 text-sm text-muted">{tp("noPrice")}</p> : (
            <ul>
              {prices.map(({ p, unit }) => {
                const fr = freshness(p.sourceUpdatedAt, now);
                const o = outageOf.get(p.fuelCode);
                return (
                  <li key={p.fuelCode} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0">
                    <div>
                      <p className="font-medium">{tf(p.fuelCode as never)}</p>
                      <p className={`text-xs ${fr === "fresh" ? "text-muted" : "text-tier-1"}`}>
                        {f.relativeTime(p.sourceUpdatedAt, now)} · {p.origin === "community" ? tp("community") : tp("official")}
                        {fr !== "fresh" && ` · ${tp("old")}`}
                      </p>
                      {o && <p className="text-xs font-medium text-danger">
                        {o.origin === "community" ? t("outageCommunity", { ago: f.relativeTime(o.startedAt, now) }) : t(o.kind === "permanent" ? "outagePermanent" : "outageTemporary")}
                      </p>}
                    </div>
                    <p className={`price text-lg font-semibold ${o ? "text-muted line-through" : ""}`}>
                      {f.number(p.price, { style: "currency", currency: p.currency, minimumFractionDigits: 3 })}
                      <span className="text-xs font-normal text-muted">/{unit}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {activeOutages.filter((o) => !priceAt.has(o.fuelCode) && o.kind === "permanent").length > 0 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">
              {t("outagePermanent")} : {activeOutages.filter((o) => !priceAt.has(o.fuelCode)).map((o) => tf(o.fuelCode as never)).join(", ")}
            </p>
          )}
        </section>

        <ContributionPanel stationId={id} soldFuels={prices.map(({ p }) => p.fuelCode)} />

        <section className="card px-4 py-3">
          <h2 className="mb-2 font-semibold">{t("hours")}</h2>
          {st.is24hAutomat && <p className="mb-2 text-sm">{t("automat24")}</p>}
          {h.length === 0 ? <p className="text-sm text-muted">{t("hoursUnknown")}</p> : (
            <table className="w-full text-sm">
              <tbody>
                {h.map(([d, o, c, closed]) => (
                  <tr key={d} className={today?.[0] === d ? "font-semibold" : ""}>
                    <th scope="row" className="py-0.5 pr-4 text-left font-normal">{days[d]}</th>
                    <td className="price">{closed ? t("closed") : o && c ? (o === c ? "24 h" : `${o} – ${c}`) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {st.services.length > 0 && (
          <section className="card px-4 py-3">
            <h2 className="mb-2 font-semibold">{t("services")}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {st.services.map((x) => <li key={x} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{ts(x as never)}</li>)}
            </ul>
          </section>
        )}

        <p className="text-xs text-muted">
          {t("source")} : <a className="underline" href={s.src.url ?? "#"} target="_blank" rel="noopener noreferrer">{s.src.attribution}</a> — {s.src.license}
        </p>
      </article>
    </div>
  );
}
