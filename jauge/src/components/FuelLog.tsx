"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addFillUp, applyRealConsumption, deleteFillUp } from "@/app/actions/app";
import type { LogStats } from "@/lib/fuel-log";
import { useFmt } from "./format";

/** Date locale au format attendu par <input type="datetime-local">. */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function LogStatsPanel({ stats, vehicleId, declared, unit }: { stats: LogStats; vehicleId: number; declared: number; unit: string }) {
  const t = useTranslations("log");
  const fmt = useFmt();
  const f = useFormatter();
  const [pending, start] = useTransition();
  const [applied, setApplied] = useState(false);
  const real = stats.avgPer100;
  const gap = real !== null ? Math.abs(real - declared) / declared : 0;

  return (
    <section className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("realConsumption")}</dt>
          <dd className="price text-lg font-semibold">{real !== null ? f.number(real, { maximumFractionDigits: 1 }) : "—"}</dd>
          <dd className="text-xs text-muted">{unit}/100 km</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("costPer100")}</dt>
          <dd className="price text-lg font-semibold">{stats.costPer100 !== null ? fmt.money(stats.costPer100) : "—"}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <dt className="text-xs text-muted">{t("avgPrice")}</dt>
          <dd className="price text-lg font-semibold">{stats.avgUnitPrice !== null ? fmt.price(stats.avgUnitPrice) : "—"}</dd>
        </div>
      </dl>
      {real === null && <p className="text-sm text-muted">{t("needTwoFull")}</p>}
      {real !== null && gap > 0.05 && !applied && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <p>{t("declaredVsReal", { declared: f.number(declared, { maximumFractionDigits: 1 }), real: f.number(real, { maximumFractionDigits: 1 }) })}</p>
          <button type="button" className="btn-ghost" disabled={pending}
            onClick={() => start(async () => { await applyRealConsumption(vehicleId, real); setApplied(true); })}>{t("applyReal")}</button>
        </div>
      )}
      {stats.byMonth.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 text-base font-medium md:text-sm">{t("byMonth")}</summary>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {stats.byMonth.map((m) => (
                <tr key={m.month}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">{f.dateTime(new Date(`${m.month}-01T12:00:00Z`), { month: "long", year: "numeric" })}</th>
                  <td className="price px-3 py-2 text-right">{m.amount.toFixed(1)} {unit}</td>
                  <td className="price px-3 py-2 text-right font-semibold">{fmt.money(m.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

export function FillUpForm({ vehicleId, prefill, lastOdometer }: {
  vehicleId: number; prefill: { stationId: number; label: string; price: number | null } | null; lastOdometer: number | null;
}) {
  const t = useTranslations("log");
  const tc = useTranslations("common");
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const [now] = useState(() => localInput(new Date()));

  // Prix connu de la station : le montant se calcule à partir de la quantité (modifiable).
  const onAmount = (v: string) => {
    setAmount(v);
    if (prefill?.price && Number(v) > 0) setTotal((Number(v) * prefill.price).toFixed(2));
  };

  return (
    <form className="space-y-3 rounded-lg border border-border p-4" onChange={() => setState("idle")} onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const form = e.currentTarget;
      start(async () => {
        try {
          await addFillUp({
            vehicleId, stationId: prefill?.stationId ?? null, filledAt: new Date(f.filledAt), amount: Number(f.amount),
            totalCost: Number(f.totalCost), odometerKm: f.odometerKm ? Number(f.odometerKm) : null, fullTank: f.fullTank === "on", note: f.note,
          });
          form.reset(); setAmount(""); setTotal(""); setState("saved");
        } catch { setState("error"); }
      });
    }}>
      <h2 className="text-lg font-semibold">{t("add")}</h2>
      {prefill && <p className="text-sm">{t("atStation", { station: prefill.label })}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">{t("amount")}</span>
          <input className="input price" name="amount" type="number" step="any" min={0.1} required inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value)} /></label>
        <label><span className="label">{t("total")}</span>
          <input className="input price" name="totalCost" type="number" step="any" min={0.01} required inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
        <label><span className="label">{t("odometer")}</span>
          <input className="input price" name="odometerKm" type="number" step={1} min={lastOdometer ?? 0} inputMode="numeric" placeholder={lastOdometer ? String(lastOdometer) : ""} /></label>
        <label><span className="label">{t("date")}</span>
          <input className="input" name="filledAt" type="datetime-local" required defaultValue={now} max={now} /></label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-base md:text-sm">
        <input type="checkbox" name="fullTank" className="h-5 w-5 accent-[var(--accent)]" defaultChecked />{t("fullTank")}
      </label>
      <label className="block"><span className="label">{t("note")}</span>
        <input className="input" name="note" maxLength={200} /></label>
      {state === "error" && <p role="alert" className="text-sm text-danger">{tc("error")}</p>}
      {state === "saved" && <p role="status" className="text-sm text-tier-0">{t("saved")}</p>}
      <button className="btn-primary w-full" disabled={pending}>{t("save")}</button>
    </form>
  );
}

type Item = { id: number; filledAt: string; amount: number; totalCost: number; currency: string; odometerKm: number | null; fullTank: boolean; stationId: number | null; stationLabel: string | null; note: string | null };

export function FillUpList({ items }: { items: Item[] }) {
  const t = useTranslations("log");
  const tc = useTranslations("common");
  const fmt = useFmt();
  const f = useFormatter();
  const [pending, start] = useTransition();
  if (!items.length) return <p className="text-base text-muted">{t("empty")}</p>;
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{t("history")}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium">{f.dateTime(new Date(it.filledAt), { dateStyle: "medium" })}
                {!it.fullTank && <span className="ml-2 rounded-full bg-surface-2 px-2 text-xs text-muted">{t("partial")}</span>}</p>
              <p className="truncate text-sm text-muted">
                {it.amount.toFixed(1)} · {fmt.price(it.totalCost / it.amount, it.currency)}
                {it.odometerKm !== null && ` · ${f.number(it.odometerKm)} km`}
                {it.stationLabel && <> · {it.stationId ? <Link className="text-accent" href={`/station/${it.stationId}`}>{it.stationLabel}</Link> : it.stationLabel}</>}
              </p>
              {it.note && <p className="truncate text-sm text-muted">{it.note}</p>}
            </div>
            <p className="price shrink-0 text-base font-semibold">{fmt.money(it.totalCost, it.currency)}</p>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-2" aria-label={tc("delete")}
              disabled={pending} onClick={() => start(() => deleteFillUp(it.id))}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
