import { eq, sql } from "drizzle-orm";
import { Unzip, UnzipInflate } from "fflate";
import { fetchWithRetry } from "@/connectors/types";
import { db } from "@/db";
import { priceHistory, station } from "@/db/schema";
import type { FuelCode } from "./fuels";
import { parseIsoLocal } from "./time";

const FR_FUEL: Record<string, FuelCode> = { Gazole: "B7", SP95: "E5", SP98: "E5_98", E10: "E10", E85: "E85", GPLc: "LPG" };
const BATCH = 5000;

type Point = { externalId: string; fuel: FuelCode; price: number; at: Date };

/**
 * Lit une archive annuelle FR (XML ISO-8859-1, ~330 Mo décompressé) en flux, ligne à ligne,
 * et ne garde que les changements de prix postérieurs à `since`.
 */
export function* parseFrArchiveLines(lines: Iterable<string>, since: Date): Generator<Point> {
  let pdv: string | null = null;
  const last = new Map<string, number>();
  for (const line of lines) {
    const p = line.match(/<pdv id="(\d+)"/);
    if (p) { pdv = p[1]; last.clear(); continue; }
    if (!pdv || !line.includes("<prix ")) continue;
    const m = line.match(/nom="([^"]+)"[^>]*maj="([^"]+)"[^>]*valeur="([\d.]+)"/);
    const fuel = m && FR_FUEL[m[1]];
    if (!fuel) continue;
    const price = Number(m![3]);
    if (last.get(fuel) === price) continue; // relevé sans changement
    last.set(fuel, price);
    const at = parseIsoLocal(m![2], "Europe/Paris");
    if (at && at >= since) yield { externalId: pdv, fuel, price, at };
  }
}

/** Décompresse le premier fichier de l'archive en flux et produit ses lignes (latin1). */
function* zipLines(zip: Uint8Array): Generator<string> {
  let chunks: string[] = [];
  const decoder = new TextDecoder("latin1");
  let rest = "";
  const unzip = new Unzip((file) => {
    file.ondata = (err, data) => {
      if (err) throw err;
      const text = rest + decoder.decode(data, { stream: true });
      const parts = text.split("\n");
      rest = parts.pop() ?? "";
      for (const l of parts) chunks.push(l);
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  const STEP = 1 << 20;
  for (let i = 0; i < zip.length; i += STEP) {
    unzip.push(zip.subarray(i, i + STEP), i + STEP >= zip.length);
    const ready = chunks;
    chunks = [];
    yield* ready;
  }
  if (rest) yield rest;
}

export async function importFrHistory(year: number, since: Date, zip?: Uint8Array) {
  if (!zip) {
    const res = await fetchWithRetry(`https://donnees.roulez-eco.fr/opendata/annee/${year}`);
    zip = new Uint8Array(await res.arrayBuffer());
  }
  const ids = new Map((await db.select({ id: station.id, ext: station.externalId }).from(station).where(eq(station.sourceId, "fr")))
    .map((s) => [s.ext, s.id]));
  let batch: (typeof priceHistory.$inferInsert)[] = [];
  let inserted = 0;
  const flush = async () => {
    if (!batch.length) return;
    await db.insert(priceHistory).values(batch).onConflictDoNothing();
    inserted += batch.length;
    batch = [];
  };
  for (const p of parseFrArchiveLines(zipLines(zip), since)) {
    const stationId = ids.get(p.externalId);
    if (!stationId) continue;
    batch.push({ stationId, fuelCode: p.fuel, price: p.price, currency: "EUR", validFrom: p.at });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return { year, inserted };
}

/** Fenêtre glissante (365 jours par défaut) : année en cours + année précédente si nécessaire. */
export async function importFrHistoryWindow(days = Number(process.env.HISTORY_DAYS ?? 365)) {
  const since = new Date(Date.now() - days * 86_400_000);
  const results = [];
  for (let y = since.getUTCFullYear(); y <= new Date().getUTCFullYear(); y++) results.push(await importFrHistory(y, since));
  await db.execute(sql`analyze price_history`);
  return results;
}
