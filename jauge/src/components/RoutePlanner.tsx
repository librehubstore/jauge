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

  return (
    <div className="flex h-full flex-col md:flex-row">
      <section className="order-2 min-h-0 flex-1 overflow-y-auto border-border md:order-1 md:w-[440px] md:flex-none md:border-r">
        <form className="space-y-3 border-b border-border bg-surface p-3" onSubmit={(e) => { e.preventDefault(); void plan(); }}>
          <div><p className="label">{t("from")}</p><PlaceLookup placeholder={t("from")} selected={from} onPick={setFrom} />
            {from && <p className="mt-1 text-xs text-muted">✓ {from.label}</p>}</div>
          {via.map((v, i) => (
            <div key={i}>
              <div className="flex items-center justify-between"><p className="label">{t("via", { n: i + 1 })}</p>
                <button type="button" className="text-xs text-danger" onClick={() => setVia((x) => x.filter((_, j) => j !== i))}>{tc("delete")}</button></div>
              <PlaceLookup placeholder={t("via", { n: i + 1 })} selected={v} onPick={(p) => setVia((x) => x.map((y, j) => (j === i ? p : y)))} />
              {v && <p className="mt-1 text-xs text-muted">✓ {v.label}</p>}
            </div>
          ))}
          {via.length < 3 && <button type="button" className="text-sm text-accent" onClick={() => setVia((x) => [...x, null])}>+ {t("addVia")}</button>}
          <div><p className="label">{t("to")}</p><PlaceLookup placeholder={t("to")} selected={to} onPick={setTo} />
            {to && <p className="mt-1 text-xs text-muted">✓ {to.label}</p>}</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {vehicles.length > 0 && (
              <label className="col-span-2"><span className="label">{t("vehicle")}</span>
                <select className="input" value={vehicleId ?? ""} onChange={(e) => setVehicleId(Number(e.target.value))}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select></label>
            )}
            <label className="col-span-2 text-xs text-muted">{t("level", { value: Math.round(level * 100) })}
              <input type="range" min={0.05} max={1} step={0.05} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-1 block w-full accent-[var(--accent)]" /></label>
            <label><span className="label">{t("reserve")}</span>
              <select className="input" value={reserve} onChange={(e) => setReserve(Number(e.target.value))}>
                {[0.1, 0.15, 0.2, 0.25].map((r) => <option key={r} value={r}>{Math.round(r * 100)} %</option>)}</select></label>
            <label><span className="label">{t("corridor")}</span>
              <select className="input" value={corridor} onChange={(e) => setCorridor(Number(e.target.value))}>
                {[1, 2, 5, 10, 20].map((r) => <option key={r} value={r}>{r} km</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={avoidTolls} onChange={(e) => setAvoidTolls(e.target.checked)} />{t("avoidTolls")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={avoidHighways} onChange={(e) => setAvoidHighways(e.target.checked)} />{t("avoidHighways")}</label>
          </div>
          <button className="btn-primary w-full" disabled={busy || !from || !to}>{busy ? tc("loading") : t("plan")}</button>
          {error && <p role="alert" className="text-sm text-danger">{t("error")}</p>}
        </form>

        {result && (
          <div className="space-y-3 p-3">
            <p className="text-sm text-muted">{t("summary", { km: Math.round(result.route.km), h: Math.floor(result.route.minutes / 60), m: result.route.minutes % 60, n: result.candidates })}</p>
            <div role="tablist" className="flex gap-1">
              {STRATEGIES.map((s) => (
                <button key={s} type="button" role="tab" aria-selected={strategy === s} onClick={() => setStrategy(s)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs ${strategy === s ? "bg-accent text-accent-fg" : "bg-surface-2"}`}>{t(`strategies.${s}`)}</button>
              ))}
            </div>
            <p className="text-xs text-muted">{t(`strategyHelp.${strategy}`)}</p>
            {!current ? <p className="text-sm text-danger">{t("infeasible")}</p> : (
              <>
                <div className="card grid grid-cols-3 divide-x divide-border text-center text-sm">
                  <div className="p-2"><p className="text-xs text-muted">{t("total")}</p><p className="price font-semibold">{fmt.money(current.fuelCost)}</p></div>
                  <div className="p-2"><p className="text-xs text-muted">{t("litres")}</p><p className="price font-semibold">{current.amount.toFixed(1)}</p></div>
                  <div className="p-2"><p className="text-xs text-muted">{t("saving")}</p><p className="price font-semibold text-tier-0">{current.saving !== null ? fmt.money(Math.max(0, current.saving)) : "—"}</p></div>
                </div>
                {current.stops.length === 0 && <p className="text-sm">{t("noStop")}</p>}
                <ol className="space-y-2">
                  {current.stops.map((s, i) => (
                    <li key={s.id} className="card px-3 py-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <Link href={`/station/${s.id}`} className="font-medium hover:underline">{i + 1}. {s.label ?? s.city}</Link>
                        <span className="price font-semibold">{fmt.price(s.price, s.currency)}</span>
                      </div>
                      <p className="text-xs text-muted">{t("stopLine", { km: Math.round(s.km), city: s.city ?? "", litres: s.amount.toFixed(1), cost: fmt.money(s.cost, s.currency), detour: s.detourKm.toFixed(1) })}</p>
                      <a className="text-xs text-accent hover:underline" target="_blank" rel="noopener noreferrer"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`}>{t("navigate")} ↗</a>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted">{t("endFuel", { litres: current.endFuel.toFixed(1) })}</p>
                <div className="flex flex-wrap gap-2">
                  {gmaps && <a className="btn-ghost" href={gmaps} target="_blank" rel="noopener noreferrer">{t("openAll")}</a>}
                  <button type="button" className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* */ } }}>
                    {copied ? t("copied") : t("share")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
      <section className="relative order-1 h-[38dvh] shrink-0 md:order-2 md:h-auto md:flex-1" aria-label={t("map")}>
        <StationMap center={{ lat: from?.lat ?? 46.6, lon: from?.lon ?? 2.4, zoom: from ? 8 : 5, seq: 0 }} me={null} points={points}
          highlightId={null} onSelect={(id) => window.open(`/station/${id}`, "_self")} onUserMove={() => {}}
          recenterLabel={t("map")} onRecenter={() => {}} line={result?.route.coords} />
      </section>
    </div>
  );
}
