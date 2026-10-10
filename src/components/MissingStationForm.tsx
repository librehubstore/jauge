"use client";

import { useLocale, useTranslations } from "next-intl";
import { PlaceLookup, type Place } from "./PlaceLookup";
import { useState, useTransition } from "react";
import { contribute } from "@/app/actions/app";

// ponytail: liste courte des pays couverts ou visés ; à étendre avec les connecteurs.
const COUNTRIES = ["FR", "ES", "IT", "PT", "BE", "LU", "MC", "AD", "DE", "AT", "SI", "HR", "DK", "RO", "GB", "CH", "NL"];

export function MissingStationForm() {
  const t = useTranslations("contrib");
  const locale = useLocale();
  const [pos, setPos] = useState<Place | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const region = new Intl.DisplayNames([locale], { type: "region" });

  if (result) return <p role="status" className="rounded-md bg-accent/10 px-3 py-2 text-sm">{t(`result.${result}` as never)}</p>;
  return (
    <div className="card space-y-4 p-4">
      <PlaceLookup placeholder={t("address")} selected={pos} onPick={setPos} />
      {pos && (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          start(async () => {
            try { setResult(await contribute(null, "missing_station", { ...f, lat: pos.lat, lon: pos.lon })); }
            catch { setResult("error"); }
          });
        }}>
          <p className="text-xs text-muted sm:col-span-2">
            {t("position", { lat: pos.lat.toFixed(5), lon: pos.lon.toFixed(5) })} ·{" "}
            <a className="text-accent hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://www.openstreetmap.org/?mlat=${pos.lat}&mlon=${pos.lon}#map=18/${pos.lat}/${pos.lon}`}>OpenStreetMap ↗</a>
          </p>
          <label><span className="label">{t("name")}</span><input className="input" name="name" maxLength={80} /></label>
          <label><span className="label">{t("brand")}</span><input className="input" name="brand" maxLength={60} /></label>
          <label><span className="label">{t("address")}</span><input className="input" name="address" maxLength={160} defaultValue={pos.label.split(",")[0]} /></label>
          <label><span className="label">{t("city")}</span><input className="input" name="city" maxLength={80} /></label>
          <label><span className="label">{t("country")}</span>
            <select className="input" name="country" defaultValue="FR">
              {COUNTRIES.map((c) => <option key={c} value={c}>{region.of(c)}</option>)}
            </select>
          </label>
          <div className="flex items-end"><button className="btn-primary" disabled={pending}>{t("send")}</button></div>
        </form>
      )}
    </div>
  );
}
