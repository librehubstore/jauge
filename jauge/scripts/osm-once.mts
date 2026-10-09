import "dotenv/config";
import { readFileSync } from "node:fs";
import { enrichFrBrandsFromOsm } from "@/connectors/osm-brands";
// Usage : tsx scripts/osm-once.mts [fichier.json]  (sans fichier : interroge Overpass)
const file = process.argv[2];
console.log(await enrichFrBrandsFromOsm(file ? JSON.parse(readFileSync(file, "utf8")).elements : undefined));
process.exit(0);
