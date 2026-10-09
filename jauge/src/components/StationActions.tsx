"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { contribute, setFavorite } from "@/app/actions/app";
import { FUEL_CODES } from "@/lib/fuels";

export function FavoriteButton({ stationId, initial, labels }: { stationId: number; initial: boolean; labels: { on: string; off: string } }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} disabled={pending} title={on ? labels.on : labels.off} aria-label={on ? labels.on : labels.off}
      className="btn-ghost shrink-0"
      onClick={() => start(async () => { setOn(!on); await setFavorite(stationId, !on); })}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? "var(--danger)" : "none"} stroke={on ? "var(--danger)" : "currentColor"} strokeWidth="1.8" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}

type Tab = "outage" | "price" | "closed" | "brand_change" | "hours";

export function ContributionPanel({ stationId, soldFuels }: { stationId: number; soldFuels: string[] }) {
  const t = useTranslations("contrib");
  const tf = useTranslations("fuel");
  const [tab, setTab] = useState<Tab>("price");
  const [result, setResult] = useState<"published" | "pending" | "error" | null>(null);
  const [pending, start] = useTransition();
  const fuels = soldFuels.length ? soldFuels : FUEL_CODES.filter((c) => c !== "ADBLUE");

  function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      try { setResult((await contribute(stationId, tab, f)) as "published" | "pending"); }
      catch { setResult("error"); }
    });
  }

  return (
    <section className="card">
      <h2 className="border-b border-border px-4 py-2.5 font-semibold">{t("title")}</h2>
      <div role="tablist" className="flex flex-wrap gap-1 px-3 pt-3">
        {(["price", "outage", "closed", "brand_change", "hours"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k}
            className={`rounded-full px-3 py-1 text-xs ${tab === k ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
            onClick={() => { setTab(k); setResult(null); }}>{t(`tabs.${k}`)}</button>
        ))}
      </div>
      <form key={tab} onSubmit={send} className="flex flex-wrap items-end gap-2 p-3">
        {(tab === "price" || tab === "outage") && (
          <label className="min-w-40 flex-1 text-sm"><span className="label">{t("fuel")}</span>
            <select className="input" name="fuel">{fuels.map((c) => <option key={c} value={c}>{tf(c as never)}</option>)}</select>
          </label>
        )}
        {tab === "price" && (
          <label className="w-32 text-sm"><span className="label">{t("price")}</span>
            <input className="input price" name="price" type="number" step="any" min={0.1} max={20} required inputMode="decimal" />
          </label>
        )}
        {tab === "closed" && (
          <label className="flex-1 text-sm"><span className="label">{t("closedKind")}</span>
            <select className="input" name="kind">
              <option value="temporary">{t("temporary")}</option><option value="permanent">{t("permanent")}</option>
            </select>
          </label>
        )}
        {tab === "brand_change" && (
          <label className="flex-1 text-sm"><span className="label">{t("newBrand")}</span>
            <input className="input" name="brand" required maxLength={60} />
          </label>
        )}
        {tab === "hours" && (
          <label className="w-full text-sm"><span className="label">{t("hoursNote")}</span>
            <textarea className="input" name="note" rows={3} required minLength={3} maxLength={500} />
          </label>
        )}
        <button className="btn-primary" disabled={pending}>{t("send")}</button>
      </form>
      {result && (
        <p role="status" className={`mx-3 mb-3 rounded-md px-3 py-2 text-sm ${result === "error" ? "bg-danger/10 text-danger" : "bg-accent/10"}`}>
          {t(`result.${result}`)}
        </p>
      )}
    </section>
  );
}
