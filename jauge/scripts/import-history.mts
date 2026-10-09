// Usage : npm run import-history  — archives FR sur la fenêtre HISTORY_DAYS (365 j par défaut).
import "dotenv/config";
import { importFrHistoryWindow } from "@/lib/history-import";

const t = Date.now();
console.info(await importFrHistoryWindow(), `${((Date.now() - t) / 1000).toFixed(0)} s`);
process.exit(0);
