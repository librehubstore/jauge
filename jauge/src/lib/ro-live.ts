import { fetchRoPoint, gridPoints, inRomania, parseRo, ro } from "@/connectors/ro";
import { ingestStations } from "./ingest";

const TTL_MS = 2 * 3_600_000;
const MAX_RADIUS_KM = 10;
const BUDGET_MS = 6000;
// ponytail: mémoire du processus web (perdue au redémarrage, non partagée entre instances) ; table dédiée si plusieurs instances.
const lastFetch = new Map<string, number>();
const cellKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

/**
 * Roumanie : l'API officielle ne répond que par cercles de 5 km. Avant une recherche dans le pays,
 * on rafraîchit les cercles de la zone non consultés depuis 2 h, dans un budget de temps borné.
 */
export async function refreshRomaniaArea(lat: number, lon: number, radiusKm: number) {
  if (!inRomania(lat, lon)) return 0;
  const now = Date.now();
  const todo = gridPoints(lat, lon, Math.min(radiusKm, MAX_RADIUS_KM))
    .filter(([a, b]) => now - (lastFetch.get(cellKey(a, b)) ?? 0) > TTL_MS);
  if (!todo.length) return 0;
  const work = (async () => {
    const responses = [];
    for (let i = 0; i < todo.length; i += 2) {
      const batch = todo.slice(i, i + 2);
      responses.push(...(await Promise.all(batch.map(([a, b]) => fetchRoPoint(a, b).catch(() => [])))).flat());
      for (const [a, b] of batch) lastFetch.set(cellKey(a, b), now);
    }
    const rows = parseRo(responses);
    if (rows.length) await ingestStations(ro, rows);
    return rows.length;
  })();
  // La recherche n'attend pas au-delà du budget : les données suivent à la recherche suivante.
  return Promise.race([work, new Promise<number>((r) => setTimeout(() => r(-1), BUDGET_MS))]).catch(() => 0);
}
