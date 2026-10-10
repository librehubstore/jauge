"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Strategy } from "@/lib/fuel-plan";
import { useFmt } from "./format";
import { PlaceLookup, type Place } from "./PlaceLookup";
import type { MapPoint } from "./StationMap";

const StationMap = dynamic(() => import("./StationMap").then((m) => m.StationMap), { ssr: false });

type Vehicle = { id: number; name: string; fuelCode: string; isDefault: boolean };
type Stop = { id: number; label: string | null; city: string | null; km: number; price: number; amount: number; cost: number; detourKm: number; lat: number; lon: number; currency: string; arrivalFuel: number };
type PlanOut = { stops: Stop[]; amount: number; fuelCost: number; endFuel: number; saving: number | null } | null;
type Result = { route: { coords: [number, number][]; km: number; minutes: number }; median: number | null; candidates: number; plans: Record<Strategy, PlanOut> };

const STRATEGIES: Strategy[] = ["cheapest", "balanced", "fewest"];
const enc = (p: Place) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)},${p.label}`;
const dec = (s: string | null): Place | null => {
  if (!s) return null;
  const [lat, lon, ...label] = s.split(",");
  return Number.isFinite(+lat) && Number.isFinite(+lon) ? { lat: +lat, lon: +lon, label: label.join(",") } : null;
};

export function RoutePlanner({ vehicles }: { vehicles: Vehicle[] }) {
  const t = useTranslations("route");
  const tc = useTranslations("common");
  const fmt = useFmt();
  const def = vehicles.find((v) => v.isDefault) ?? vehicles[0];

  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [via, setVia] = useState<(Place | null)[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(def?.id ?? null);
  const [level, setLevel] = useState(0.25);
  const [reserve, setReserve] = useState(0.15);
  const [corridor, setCorridor] = useState(5);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>("cheapest");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(true);

  async function plan(override?: { from: Place; to: Place; via: Place[] }) {
    const a = override?.from ?? from, b = override?.to ?? to, w = override?.via ?? via.filter((x): x is Place => !!x);
    if (!a || !b) return;
    setBusy(true); setError(false);
    try {
      const res = await fetch("/api/route", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ points: [a, ...w, b], vehicleId: vehicleId ?? undefined, startLevel: level, reserve, corridorKm: corridor, avoidTolls, avoidHighways }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult(await res.json());
      setEditing(false);
      // Lien partageable : l'URL reflète l'itinéraire.
      const q = new URLSearchParams({ from: enc(a), to: enc(b), s: strategy, l: String(level), r: String(reserve), c: String(corridor) });
      w.forEach((x) => q.append("via", enc(x)));
      if (avoidTolls) q.set("nt", "1");
      if (avoidHighways) q.set("nh", "1");
      history.replaceState(null, "", `/route?${q}`);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  // Ouverture d'un lien partagé : préremplit puis calcule.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const a = dec(q.get("from")), b = dec(q.get("to"));
    if (!a || !b) return;
    const w = q.getAll("via").map(dec).filter((x): x is Place => !!x);
    /* eslint-disable react-hooks/set-state-in-effect -- initialisation unique depuis l'URL */
    setFrom(a); setTo(b); setVia(w);
    if (q.get("s")) setStrategy(q.get("s") as Strategy);
    if (q.get("l")) setLevel(Number(q.get("l")));
    if (q.get("r")) setReserve(Number(q.get("r")));
    if (q.get("c")) setCorridor(Number(q.get("c")));
    setAvoidTolls(q.get("nt") === "1"); setAvoidHighways(q.get("nh") === "1");
    /* eslint-enable react-hooks/set-state-in-effect */
    void plan({ from: a, to: b, via: w });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = result?.plans[strategy] ?? null;
  const points: MapPoint[] = useMemo(() => (current?.stops ?? []).map((s) => ({ id: s.id, lat: s.lat, lon: s.lon, tier: 0, label: s.price.toFixed(3) })), [current]);
  const gmaps = from && to && current
    ? `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&waypoints=${current.stops.map((s) => `${s.lat},${s.lon}`).join("|")}`
    : null;

  const showForm = editing || !result;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <section className="order-2 min-h-0 flex-1 overflow-y-auto overscroll-contain md:order-1 md:w-[440px] md:flex-none md:border-r md:border-border">
        {showForm ? (
          <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); void plan(); }}>
            <h1 className="text-xl font-semibold md:hidden">{t("title")}</h1>
            <PlaceLookup label={t("from")} placeholder={t("fromPlaceholder")} selected={from} onPick={setFrom} />
            {via.map((v, i) => (
              <div key={i} className="relative">
                <PlaceLookup label={t("via", { n: i + 1 })} placeholder={t("fromPlaceholder")} selected={v}
                  onPick={(p) => setVia((x) => x.map((y, j) => (j === i ? p : y)))} />
                <button type="button" className="absolute right-0 top-0 min-h-6 text-sm text-danger"
                  onClick={() => setVia((x) => x.filter((_, j) => j !== i))}>{tc("delete")}</button>
              </div>
            ))}
            {via.length < 3 && (
              <button type="button" className="min-h-11 text-base font-medium text-accent md:min-h-0 md:text-sm" onClick={() => setVia((x) => [...x, null])}>+ {t("addVia")}</button>
            )}
            <PlaceLookup label={t("to")} placeholder={t("fromPlaceholder")} selected={to} onPick={setTo} />

            {vehicles.length > 0 && (
              <label className="block"><span className="label">{t("vehicle")}</span>
                <select className="input" value={vehicleId ?? ""} onChange={(e) => setVehicleId(Number(e.target.value))}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select></label>
            )}
            <label className="block">
              <span className="label">{t("level", { value: Math.round(level * 100) })}</span>
              <input type="range" min={0.05} max={1} step={0.05} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="block h-8 w-full accent-[var(--accent)]" />
            </label>

            <details className="group rounded-lg border border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-base font-medium md:text-sm">
                {t("options")}
                <svg className="h-4 w-4 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                <label><span className="label">{t("reserve")}</span>
                  <select className="input" value={reserve} onChange={(e) => setReserve(Number(e.target.value))}>
                    {[0.1, 0.15, 0.2, 0.25].map((r) => <option key={r} value={r}>{Math.round(r * 100)} %</option>)}</select></label>
                <label><span className="label">{t("corridor")}</span>
                  <select className="input" value={corridor} onChange={(e) => setCorridor(Number(e.target.value))}>
                    {[1, 2, 5, 10, 20].map((r) => <option key={r} value={r}>{r} km</option>)}</select></label>
                <label className="col-span-2 flex min-h-11 items-center gap-3 text-base md:text-sm"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />{t("avoidTolls")}</label>
                <label className="col-span-2 flex min-h-11 items-center gap-3 text-base md:text-sm"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} />{t("avoidHighways")}</label>
              </div>
            </details>

            {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("error")}</p>}
            <div className="sticky bottom-0 -mx-4 bg-bg px-4 pb-1 pt-2 md:static md:mx-0 md:bg-transparent md:p-0">
              <button className="btn-primary w-full" disabled={busy || !from || !to}>{busy ? tc("loading") : t("plan")}</button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{from?.label.split(",")[0]} → {to?.label.split(",")[0]}</p>
              <p className="text-sm text-muted">{t("summary", { km: Math.round(result!.route.km), h: Math.floor(result!.route.minutes / 60), m: result!.route.minutes % 60, n: result!.candidates })}</p>
            </div>
            <button type="button" className="btn-ghost shrink-0" onClick={() => setEditing(true)}>{t("edit")}</button>
          </div>
        )}

        {result && !editing && (
          <div className="space-y-4 p-4">
            <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
              {STRATEGIES.map((s) => (
                <button key={s} type="button" role="tab" aria-selected={strategy === s} onClick={() => setStrategy(s)}
                  className={`min-h-10 rounded-md px-1 text-sm font-medium ${strategy === s ? "bg-surface text-fg shadow-sm" : "text-muted"}`}>{t(`strategies.${s}`)}</button>
              ))}
            </div>
            <p className="text-sm text-muted">{t(`strategyHelp.${strategy}`)}</p>
            {!current ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("infeasible")}</p> : (
              <>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface-2 p-2"><dt className="text-xs text-muted">{t("total")}</dt><dd className="price text-lg font-semibold">{fmt.money(current.fuelCost)}</dd></div>
                  <div className="rounded-lg bg-surface-2 p-2"><dt className="text-xs text-muted">{t("litres")}</dt><dd className="price text-lg font-semibold">{current.amount.toFixed(1)}</dd></div>
                  <div className="rounded-lg bg-tier-0/15 p-2"><dt className="text-xs text-muted">{t("saving")}</dt><dd className="price text-lg font-semibold text-tier-0">{current.saving !== null ? fmt.money(Math.max(0, current.saving)) : "—"}</dd></div>
                </dl>
                {current.stops.length === 0 && <p className="text-base">{t("noStop")}</p>}
                <ol className="divide-y divide-border rounded-lg border border-border">
                  {current.stops.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 p-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg">{i + 1}</span>
                      <Link href={`/station/${s.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{s.label ?? s.city}</p>
                        <p className="text-sm text-muted">{t("stopLine", { km: Math.round(s.km), city: s.city ?? "", litres: s.amount.toFixed(1), cost: fmt.money(s.cost, s.currency), detour: s.detourKm.toFixed(1) })}</p>
                      </Link>
                      <div className="shrink-0 text-right">
                        <p className="price text-base font-semibold">{fmt.price(s.price, s.currency)}</p>
                        <a className="inline-flex min-h-9 items-center text-sm font-medium text-accent" target="_blank" rel="noopener noreferrer"
                          href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}>{t("navigate")}</a>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-sm text-muted">{t("endFuel", { litres: current.endFuel.toFixed(1) })}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {gmaps && <a className="btn-primary" href={gmaps} target="_blank" rel="noopener noreferrer">{t("openAll")}</a>}
                  <button type="button" className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* */ } }}>
                    {copied ? t("copied") : t("share")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      {/* Mobile : la carte n'apparaît qu'avec un itinéraire calculé */}
      <section className={`relative order-1 h-[34dvh] shrink-0 md:order-2 md:block md:h-auto md:flex-1 ${result && !editing ? "" : "hidden"}`} aria-label={t("map")}>
        <StationMap center={{ lat: from?.lat ?? 46.6, lon: from?.lon ?? 2.4, zoom: from ? 8 : 5, seq: 0 }} me={null} points={points}
          highlightId={null} onSelect={(id) => window.open(`/station/${id}`, "_self")} onUserMove={() => {}}
          recenterLabel={t("map")} line={result?.route.coords} />
      </section>
    </div>
  );
}
