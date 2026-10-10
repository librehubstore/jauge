import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/i18n/config";

type Tree = { [k: string]: string | string[] | Tree };
const load = (l: string) => JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Tree;

/** clé → variables ICU utilisées (« {name} », « {count, plural, …} ») */
function flatten(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix + k;
    if (typeof v === "string") out.set(key, [...v.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort().join(","));
    else if (Array.isArray(v)) out.set(key, `array:${v.length}`);
    else for (const [kk, vv] of flatten(v, key + ".")) out.set(kk, vv);
  }
  return out;
}

describe("traductions", () => {
  const ref = flatten(load("en"));
  for (const l of LOCALES) {
    it(`${l} : mêmes clés et mêmes variables que l'anglais`, () => {
      const cur = flatten(load(l));
      expect([...ref.keys()].filter((k) => !cur.has(k))).toEqual([]);
      expect([...cur.keys()].filter((k) => !ref.has(k))).toEqual([]);
      expect([...ref].filter(([k, v]) => cur.get(k) !== v).map(([k]) => k)).toEqual([]);
    });
  }
});
