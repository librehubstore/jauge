"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { priceAt } from "@/lib/trend";

type Series = [number, number][];
const PERIODS = [7, 30, 365] as const;
const W = 640, H = 220, PAD = { l: 52, r: 12, t: 12, b: 26 };

export function PriceHistoryChart({ stationId, fuels, currency }: { stationId: number; fuels: string[]; currency: string }) {
  const t = useTranslations("history");
  const tf = useTranslations("fuel");
  const f = useFormatter();
  const [fuel, setFuel] = useState(fuels[0]);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<{ station: Series; zone: Series; now: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/stations/${stationId}/history?${new URLSearchParams({ fuel, days: String(days) })}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setData({ ...d, now: Date.now() })).catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 0);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [stationId, fuel, days]);

  const now = data?.now ?? 0;
  const start = now - days * 86_400_000;
  const geo = useMemo(() => {
    if (!data) return null;
    const vals = [...data.station, ...data.zone].filter(([ts]) => ts >= start - 30 * 86_400_000).map(([, p]) => p);
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(0.02, max - min);
    const y0 = min - span * 0.1, y1 = max + span * 0.1;
    const x = (ts: number) => PAD.l + ((Math.max(ts, start) - start) / (now - start)) * (W - PAD.l - PAD.r);
    const y = (p: number) => PAD.t + (1 - (p - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
    // Ligne en escalier : un prix reste en vigueur jusqu'au changement suivant.
    const path = (s: Series) => {
      const pts = s.filter(([ts], i) => ts >= start || s[i + 1]?.[0] > start || i === s.length - 1);
      if (!pts.length) return "";
      let d = `M${x(pts[0][0])},${y(pts[0][1])}`;
      for (let i = 1; i < pts.length; i++) d += `H${x(pts[i][0])}V${y(pts[i][1])}`;
      return d + `H${x(now)}`;
    };
    return { y0, y1, x, y, station: path(data.station), zone: path(data.zone) };
  }, [data, start, now]);

  const money = (v: number) => f.number(v, { style: "currency", currency, minimumFractionDigits: 3 });
  const date = (ts: number) => f.dateTime(new Date(ts), days > 30 ? { day: "numeric", month: "short", year: "2-digit" } : { day: "numeric", month: "short" });

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const ratio = Math.min(1, Math.max(0, (px - PAD.l) / (W - PAD.l - PAD.r)));
    setHover(start + ratio * (now - start));
  }

  const hs = hover !== null && data ? priceAt(data.station, hover) : null;
  const hz = hover !== null && data ? priceAt(data.zone, hover) : null;

  return (
    <section className="card px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-semibold">{t("title")}</h2>
        <select className="rounded-md border border-border bg-surface px-2 py-1 text-sm" value={fuel} aria-label={t("fuel")}
          onChange={(e) => setFuel(e.target.value)}>
          {fuels.map((c) => <option key={c} value={c}>{tf(c as never)}</option>)}
        </select>
        <div role="group" aria-label={t("period")} className="flex gap-1">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}
              className={`rounded-md px-2.5 py-1 text-xs ${days === p ? "bg-accent text-accent-fg" : "bg-surface-2"}`}>{t(`p${p}`)}</button>
          ))}
        </div>
      </div>

      {/* Légende : deux séries, clé en trait (comme la marque) */}
      <ul className="mb-1 flex gap-4 text-xs text-muted">
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-1)]" aria-hidden="true" />{t("station")}</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-[var(--series-2)]" aria-hidden="true" />{t("zone")}</li>
      </ul>

      {!geo ? (
        <p className="py-8 text-center text-sm text-muted">{loading ? "…" : t("empty")}</p>
      ) : (
        <div className={`relative ${loading ? "opacity-50" : ""}`}>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img" aria-label={t("aria", { fuel: tf(fuel as never) })}
            onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            {[geo.y0, (geo.y0 + geo.y1) / 2, geo.y1].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--border)" strokeWidth="1" />
                <text x={PAD.l - 6} y={geo.y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="price">{v.toFixed(3)}</text>
              </g>
            ))}
            <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--muted)">{date(start)}</text>
            <text x={W - PAD.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{date(now)}</text>
            <path d={geo.zone} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeLinejoin="round" />
            <path d={geo.station} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
            {hover !== null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--muted)" strokeWidth="1" />}
          </svg>
          {hover !== null && (hs !== null || hz !== null) && (
            <div className="pointer-events-none absolute top-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
              style={{ left: `${Math.min(70, (geo.x(hover) / W) * 100)}%` }}>
              <p className="text-muted">{date(hover)}</p>
              {hs !== null && <p className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[var(--series-1)]" /><strong className="price">{money(hs)}</strong> <span className="text-muted">{t("station")}</span></p>}
              {hz !== null && <p className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[var(--series-2)]" /><strong className="price">{money(hz)}</strong> <span className="text-muted">{t("zone")}</span></p>}
            </div>
          )}
        </div>
      )}

      {data && data.station.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-muted">{t("table")}</summary>
          <table className="mt-2 w-full text-xs">
            <thead className="text-left text-muted"><tr><th className="py-1 font-medium">{t("date")}</th><th className="py-1 text-right font-medium">{t("station")}</th></tr></thead>
            <tbody>
              {[...data.station].reverse().filter(([ts]) => ts >= start).slice(0, 60).map(([ts, p]) => (
                <tr key={ts} className="border-t border-border">
                  <td className="py-1">{f.dateTime(new Date(ts), { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="price py-1 text-right">{money(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
