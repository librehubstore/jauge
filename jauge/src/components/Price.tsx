"use client";

import { useFmt } from "./format";

/** Prix formaté côté client (conversion de devise éventuelle), utilisable dans les pages serveur. */
export function Price({ value, currency }: { value: number; currency: string }) {
  const fmt = useFmt();
  return <span title={fmt.converted(currency) ? fmt.convertedLabel : undefined}>{fmt.price(value, currency)}</span>;
}
