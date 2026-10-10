"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { convert } from "@/lib/fx";
import { useFx } from "./FxContext";

export function useFmt(distanceUnit: "km" | "mi" = "km") {
  const f = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const fx = useFx();
  const t = useTranslations("price");
  // Montant dans la devise d'affichage choisie (taux BCE), marqué « ≈ » et « converti » s'il a été converti.
  const money = (v: number, currency: string, digits: number) => {
    const c = fx.target && fx.target !== currency ? convert(v, currency, fx.target, fx.rates) : null;
    const opts = { style: "currency" as const, minimumFractionDigits: digits, maximumFractionDigits: digits };
    return c === null
      ? f.number(v, { ...opts, currency })
      : `≈ ${f.number(c, { ...opts, currency: fx.target! })}`;
  };
  return {
    price: (v: number, currency = "EUR") => money(v, currency, 3),
    money: (v: number, currency = "EUR") => money(v, currency, 2),
    converted: (currency = "EUR") => !!fx.target && fx.target !== currency && !!fx.rates[fx.target] && !!fx.rates[currency],
    convertedLabel: t("converted"),
    distance: (km: number) => {
      const v = distanceUnit === "mi" ? km * 0.621371 : km;
      return `${f.number(v, { maximumFractionDigits: v < 10 ? 1 : 0 })} ${distanceUnit}`;
    },
    ago: (iso: string) => f.relativeTime(new Date(iso), now),
  };
}
