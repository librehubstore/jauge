"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createAlert, deleteAlert, setAlertActive } from "@/app/actions/app";
import { FUEL_CODES } from "@/lib/fuels";
import { PlaceLookup, type Place } from "./PlaceLookup";

export function AlertActions({ id, active }: { id: number; active: boolean }) {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => setAlertActive(id, !active))}>
        {active ? t("pause") : t("resume")}
      </button>
      <button className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => start(() => deleteAlert(id))}>{tc("delete")}</button>
    </div>
  );
}

/** Alerte « favoris » ou « zone » (la page d'une station propose l'alerte « station »). */
export function NewAlertForm({ defaultFuel }: { defaultFuel: string }) {
  const t = useTranslations("alerts");
  const tf = useTranslations("fuel");
  const [scope, setScope] = useState<"favorites" | "area">("favorites");
  const [place, setPlace] = useState<Place | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form className="card space-y-3 p-4" onChange={() => setDone(false)} onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const base = { fuelCode: f.fuelCode, threshold: Number(f.threshold) };
      start(async () => {
        if (scope === "favorites") await createAlert({ scope, ...base });
        else if (place) await createAlert({ scope, ...base, lat: place.lat, lon: place.lon, radiusKm: Number(f.radiusKm), label: place.label });
        else return;
        setDone(true);
      });
    }}>
      <h2 className="font-semibold">{t("new")}</h2>
      <div role="radiogroup" className="flex gap-4 text-sm">
        {(["favorites", "area"] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5">
            <input type="radio" name="scope" checked={scope === s} onChange={() => setScope(s)} />{t(s === "area" ? "scopeAreaShort" : "scopeFavorites")}
          </label>
        ))}
      </div>
      {scope === "area" && (
        <div className="space-y-2">
          <PlaceLookup placeholder={t("place")} selected={place} onPick={setPlace} />
          <label className="block text-sm"><span className="label">{t("radius")}</span>
            <select className="input" name="radiusKm" defaultValue={10}>{[2, 5, 10, 20, 30, 50].map((r) => <option key={r} value={r}>{r} km</option>)}</select>
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm"><span className="label">{t("fuel")}</span>
          <select className="input" name="fuelCode" defaultValue={defaultFuel}>{FUEL_CODES.map((c) => <option key={c} value={c}>{tf(c)}</option>)}</select>
        </label>
        <label className="text-sm"><span className="label">{t("threshold")}</span>
          <input className="input price" name="threshold" type="number" step="any" min={0.1} max={20} required inputMode="decimal" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending || (scope === "area" && !place)}>{t("create")}</button>
        {done && <span role="status" className="text-sm text-muted">{t("created")}</span>}
      </div>
    </form>
  );
}

export function StationAlertForm({ stationId, fuels, suggested }: { stationId: number; fuels: string[]; suggested: Record<string, number> }) {
  const t = useTranslations("alerts");
  const tf = useTranslations("fuel");
  const [fuel, setFuel] = useState(fuels[0]);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="rounded-md bg-accent/10 px-3 py-2 text-sm">{t("created")}</p>;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      const threshold = Number(new FormData(e.currentTarget).get("threshold"));
      start(async () => { await createAlert({ scope: "station", stationId, fuelCode: fuel, threshold }); setDone(true); });
    }}>
      <label className="min-w-40 flex-1 text-sm"><span className="label">{t("stationTitle")}</span>
        <select className="input" value={fuel} onChange={(e) => setFuel(e.target.value)}>{fuels.map((c) => <option key={c} value={c}>{tf(c as never)}</option>)}</select>
      </label>
      <label className="w-32 text-sm"><span className="label">{t("threshold")}</span>
        <input key={fuel} className="input price" name="threshold" type="number" step="any" min={0.1} max={20} required
          defaultValue={suggested[fuel]?.toFixed(3)} inputMode="decimal" />
      </label>
      <button className="btn-ghost" disabled={pending}>{t("create")}</button>
    </form>
  );
}
