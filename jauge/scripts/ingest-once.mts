// Usage : npm run ingest -- [fr es it]  — bootstrap puis ingestion immédiate (sans worker).
import "dotenv/config";
import { CONNECTORS } from "@/connectors";
import { bootstrap } from "@/lib/bootstrap";
import { runConnector } from "@/lib/ingest";

await bootstrap();
const ids = process.argv.slice(2);
for (const c of CONNECTORS.filter((c) => !ids.length || ids.includes(c.id))) {
  const t = Date.now();
  try {
    console.info(c.id, await runConnector(c), `${((Date.now() - t) / 1000).toFixed(1)} s`);
  } catch (e) {
    console.error(c.id, "échec", e);
  }
}
process.exit(0);
