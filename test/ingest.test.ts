import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { fr, parseFr } from "@/connectors/fr";
import { db } from "@/db";
import { priceHistory, station, stationFuelPrice } from "@/db/schema";
import { bootstrap } from "@/lib/bootstrap";
import { runConnector } from "@/lib/ingest";

const rows = () => parseFr(readFileSync("test/fixtures/fr.xml"));

describe("ingestion (base de test)", () => {
  beforeAll(async () => {
    await bootstrap();
    await db.delete(station);
  });

  it("produit des stations géolocalisées et des prix horodatés", async () => {
    const r = await runConnector(fr, async () => rows());
    expect(r.stationsUpserted).toBe(3);
    const [s] = await db.select().from(station).where(eq(station.externalId, "40500002"));
    expect(s.location.y).toBeCloseTo(43.773, 3);
    const prices = await db.select().from(stationFuelPrice).where(eq(stationFuelPrice.stationId, s.id));
    expect(prices.find((p) => p.fuelCode === "B7")?.sourceUpdatedAt.toISOString()).toBe("2026-10-07T06:54:39.000Z");
  });

  it("deux ingestions du même fichier n'ajoutent aucun point d'historique", async () => {
    const before = (await db.select({ n: count() }).from(priceHistory))[0].n;
    const r = await runConnector(fr, async () => rows());
    const after = (await db.select({ n: count() }).from(priceHistory))[0].n;
    expect(after).toBe(before);
    expect(r.pricesChanged).toBe(0);
  });

  it("un changement de prix crée un seul point d'historique", async () => {
    const changed = rows();
    changed[0].prices[0] = { ...changed[0].prices[0], price: 2.299, updatedAt: new Date("2026-10-08T06:00:00Z") };
    const before = (await db.select({ n: count() }).from(priceHistory))[0].n;
    const r = await runConnector(fr, async () => changed);
    expect(r.pricesChanged).toBe(1);
    expect((await db.select({ n: count() }).from(priceHistory))[0].n).toBe(before + 1);
  });

  it("le bootstrap est idempotent (admin créé une seule fois)", async () => {
    await bootstrap();
    await bootstrap();
  });
});
