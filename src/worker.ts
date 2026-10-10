import "dotenv/config";
import { PgBoss } from "pg-boss";
import { CONNECTORS, connectorById } from "@/connectors";
import { enrichFrBrandsFromOsm } from "@/connectors/osm-brands";
import { bootstrap } from "@/lib/bootstrap";
import { runConnector } from "@/lib/ingest";
import { notifyAdmins } from "@/lib/notify";
import { getSetting, refreshEcbRates } from "@/lib/settings";
import { traceFetch } from "@/lib/trace-fetch";
import { db } from "@/db";
import { source } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

traceFetch();

const QUEUE = "ingest";
const OSM_QUEUE = "osm-brands";
const FX_QUEUE = "ecb-rates";

async function main() {
  await bootstrap();
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", (e) => console.error("[pg-boss]", e));
  await boss.start();
  await boss.createQueue(QUEUE);
  await boss.createQueue(OSM_QUEUE);
  // Enseignes FR depuis OpenStreetMap : hebdomadaire (lundi 4 h UTC).
  await boss.schedule(OSM_QUEUE, "0 4 * * 1", null, { key: "osm", tz: "UTC" });
  // Taux BCE publiés vers 16 h CET les jours ouvrés.
  await boss.createQueue(FX_QUEUE);
  await boss.schedule(FX_QUEUE, "30 15 * * 1-5", null, { key: "ecb", tz: "UTC" });
  await boss.work(FX_QUEUE, async () => console.info("[fx]", await refreshEcbRates()));
  if (!(await getSetting("ecb_rates"))) await boss.send(FX_QUEUE, {});
  await boss.work(OSM_QUEUE, async () => console.info("[osm]", await enrichFrBrandsFromOsm()));

  for (const c of CONNECTORS) {
    await boss.schedule(QUEUE, c.schedule, { sourceId: c.id }, { key: c.id, tz: "UTC" });
  }

  await boss.work<{ sourceId: string }>(QUEUE, async ([job]) => {
    const c = connectorById(job.data.sourceId);
    if (!c) return;
    const [src] = await db.select().from(source).where(eq(source.id, c.id));
    if (!src?.enabled) return;
    try {
      const r = await runConnector(c);
      console.info(`[ingest] ${c.id} ok`, r);
    } catch (e) {
      console.error(`[ingest] ${c.id} échec`, e);
      if ((src.consecutiveFailures ?? 0) + 1 === 3) await notifyAdmins("connector_failing", { sourceId: c.id });
    }
  });

  // Première ingestion immédiate pour les sources jamais synchronisées.
  for (const c of CONNECTORS) {
    const [src] = await db.select().from(source).where(eq(source.id, c.id));
    if (src?.enabled && !src.lastSuccessAt) await boss.send(QUEUE, { sourceId: c.id });
  }
  const [{ n }] = (await db.execute(sql`select count(*)::int as n from station where brand_origin = 'osm'`)) as unknown as { n: number }[];
  if (!n) await boss.send(OSM_QUEUE, {}, { startAfter: 300 }); // après la première ingestion FR
  console.info("[worker] prêt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
