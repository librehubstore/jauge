"use client";

import { useFormatter, useNow } from "next-intl";

export function useFmt(distanceUnit: "km" | "mi" = "km") {
  const f = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return {
    price: (v: number, currency = "EUR") =>
      f.number(v, { style: "currency", currency, minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    money: (v: number, currency = "EUR") => f.number(v, { style: "currency", currency, maximumFractionDigits: 2 }),
    distance: (km: number) => {
      const v = distanceUnit === "mi" ? km * 0.621371 : km;
      return `${f.number(v, { maximumFractionDigits: v < 10 ? 1 : 0 })} ${distanceUnit}`;
    },
    ago: (iso: string) => f.relativeTime(new Date(iso), now),
  };
}
