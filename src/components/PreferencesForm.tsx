"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { savePreferences } from "@/app/actions/app";
import type { Preferences } from "@/db/schema";
import { FUEL_CODES } from "@/lib/fuels";
import { DISPLAY_CURRENCIES } from "@/lib/fx";

export function PreferencesForm({ prefs }: { prefs: Preferences }) {
  const t = useTranslations("settings");
  const tf = useTranslations("fuel");
  const tn = useTranslations("nav_apps");
  const tc = useTranslations("common");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form className="card grid gap-4 p-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      start(async () => {
        await savePreferences({
          distanceUnit: f.distanceUnit as Preferences["distanceUnit"], defaultFuel: f.defaultFuel,
          radiusKm: Number(f.radiusKm), navApp: f.navApp as Preferences["navApp"], theme: f.theme as Preferences["theme"],
          emailAlerts: f.emailAlerts === "on", displayCurrency: f.displayCurrency, maxPriceAgeDays: Number(f.maxPriceAgeDays),
          showOldPrices: f.showOldPrices === "on",
        });
        setSaved(true);
      });
    }} onChange={() => setSaved(false)}>
      <label><span className="label">{t("defaultFuel")}</span>
        <select className="input" name="defaultFuel" defaultValue={prefs.defaultFuel ?? "B7"}>
          {FUEL_CODES.map((c) => <option key={c} value={c}>{tf(c)}</option>)}
        </select></label>
      <label><span className="label">{t("radius")}</span>
        <select className="input" name="radiusKm" defaultValue={prefs.radiusKm ?? 10}>
          {[2, 5, 10, 20, 30, 50].map((r) => <option key={r} value={r}>{r}</option>)}
        </select></label>
      <label><span className="label">{t("maxPriceAge")}</span>
        <select className="input" name="maxPriceAgeDays" defaultValue={prefs.maxPriceAgeDays ?? 14}>
          {[1, 2, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{t("days", { count: d })}</option>)}
        </select>
        <span className="mt-1 block text-xs text-muted">{t("maxPriceAgeHint")}</span></label>
      <label><span className="label">{t("distanceUnit")}</span>
        <select className="input" name="distanceUnit" defaultValue={prefs.distanceUnit ?? "km"}>
          <option value="km">km</option><option value="mi">mi</option>
        </select></label>
      <label><span className="label">{t("navApp")}</span>
        <select className="input" name="navApp" defaultValue={prefs.navApp ?? "google"}>
          {(["google", "apple", "waze", "osm"] as const).map((k) => <option key={k} value={k}>{tn(k)}</option>)}
        </select></label>
      <label><span className="label">{t("theme")}</span>
        <select className="input" name="theme" defaultValue={prefs.theme ?? "system"}>
          {(["system", "light", "dark"] as const).map((k) => <option key={k} value={k}>{t(`themes.${k}`)}</option>)}
        </select></label>
      <label><span className="label">{t("displayCurrency")}</span>
        <select className="input" name="displayCurrency" defaultValue={prefs.displayCurrency ?? ""}>
          <option value="">{t("originalCurrency")}</option>
          {DISPLAY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select></label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="showOldPrices" defaultChecked={!!prefs.showOldPrices} /> {t("showOldPrices")}
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="emailAlerts" defaultChecked={!!prefs.emailAlerts} /> {t("emailAlerts")}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{tc("save")}</button>
        {saved && <span role="status" className="text-sm text-muted">{t("saved")}</span>}
      </div>
    </form>
  );
}
