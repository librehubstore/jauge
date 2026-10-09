import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { fr, parseFr } from "@/connectors/fr";
import { db } from "@/db";
import { contribution, station, stationFuelPrice, user } from "@/db/schema";
import { bootstrap } from "@/lib/bootstrap";
import { initialStatus, moderate, submitContribution } from "@/lib/contributions";
import { runConnector } from "@/lib/ingest";

describe("décision de publication", () => {
  it("écart > 15 % de la médiane locale → modération", () => {
    expect(initialStatus("price", { reputation: 0, price: 1.2, localMedian: 1.75 })).toBe("pending");
    expect(initialStatus("price", { reputation: 0, price: 1.7, localMedian: 1.75 })).toBe("published");
    expect(initialStatus("price", { reputation: 0, price: 1.7, localMedian: null })).toBe("published");
  });
  it("réputation < −5 → toujours en modération ; fermeture et enseigne toujours vérifiées", () => {
    expect(initialStatus("outage", { reputation: -6 })).toBe("pending");
    expect(initialStatus("outage", { reputation: 0 })).toBe("published");
    expect(initialStatus("closed", { reputation: 10 })).toBe("pending");
    expect(initialStatus("brand_change", { reputation: 10 })).toBe("pending");
  });
});

describe("contributions (base de test)", () => {
  let stationId: number;
  const uid = "test-contrib-user";
  const price = () => db.select().from(stationFuelPrice)
    .where(and(eq(stationFuelPrice.stationId, stationId), eq(stationFuelPrice.fuelCode, "B7"))).then((r) => r[0]);

  beforeAll(async () => {
    await bootstrap();
    await db.delete(station);
    await db.delete(user).where(eq(user.id, uid));
    // Prix officiels datés de plus de 24 h : une contribution plausible peut les remplacer.
    const rows = parseFr(readFileSync("test/fixtures/fr.xml")).map((s) => ({
      ...s, prices: s.prices.map((p) => ({ ...p, updatedAt: new Date(Date.now() - 3 * 86_400_000) })),
    }));
    await runConnector(fr, async () => rows);
    stationId = (await db.select().from(station).where(eq(station.externalId, "40500002")))[0].id;
    await db.insert(user).values({ id: uid, name: "Contrib", email: "contrib@test.local", emailVerified: true, status: "active" });
  });

  it("un prix à 1,20 € alors que la médiane locale est ~2,3 € n'est pas visible avant validation", async () => {
    const before = await price();
    const c = await submitContribution(uid, stationId, "price", { fuel: "B7", price: 1.2 });
    expect(c.status).toBe("pending");
    expect((await price()).price).toBe(before.price);
  });

  it("un prix plausible est publié, marqué communauté, et la réputation augmente", async () => {
    const c = await submitContribution(uid, stationId, "price", { fuel: "B7", price: 2.299 });
    expect(c.status).toBe("published");
    const p = await price();
    expect([p.price, p.origin]).toEqual([2.299, "community"]);
    expect((await db.select().from(user).where(eq(user.id, uid)))[0].reputation).toBe(1);
  });

  it("un prix officiel de moins de 24 h n'est pas remplacé", async () => {
    await db.update(stationFuelPrice).set({ origin: "official", price: 2.319, sourceUpdatedAt: new Date() })
      .where(and(eq(stationFuelPrice.stationId, stationId), eq(stationFuelPrice.fuelCode, "B7")));
    await submitContribution(uid, stationId, "price", { fuel: "B7", price: 2.309 });
    const p = await price();
    expect([p.price, p.origin]).toEqual([2.319, "official"]);
  });

  it("rejet : réputation −3 et notification ; validation d'une fermeture : statut appliqué", async () => {
    const [pending] = await db.select().from(contribution).where(eq(contribution.status, "pending"));
    expect(await moderate(pending.id, uid, "reject", "prix aberrant")).toBe("rejected");
    expect((await db.select().from(user).where(eq(user.id, uid)))[0].reputation).toBe(2 - 3);

    const c = await submitContribution(uid, stationId, "closed", { kind: "temporary" });
    expect(await moderate(c.id, uid, "approve")).toBe("published");
    expect((await db.select().from(station).where(eq(station.id, stationId)))[0].status).toBe("closed_temp");
  });
});
