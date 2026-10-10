import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { fr, parseFr } from "@/connectors/fr";
import type { RawStation } from "@/connectors/types";
import { db } from "@/db";
import { notification, priceAlert, station, user } from "@/db/schema";
import { decideAlert } from "@/lib/alerts";
import { bootstrap } from "@/lib/bootstrap";
import { runConnector } from "@/lib/ingest";

describe("règle de déclenchement", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("déclenche sous le seuil si armée, puis se réarme au-dessus", () => {
    expect(decideAlert({ threshold: 1.7, armed: true, lastTriggeredAt: null }, 1.69, now)).toBe("trigger");
    expect(decideAlert({ threshold: 1.7, armed: false, lastTriggeredAt: now }, 1.69, now)).toBeNull();
    expect(decideAlert({ threshold: 1.7, armed: false, lastTriggeredAt: now }, 1.75, now)).toBe("rearm");
    expect(decideAlert({ threshold: 1.7, armed: true, lastTriggeredAt: null }, null, now)).toBeNull();
  });
  it("au plus une fois par 24 h, même réarmée", () => {
    const recent = new Date(now.getTime() - 3 * 3_600_000);
    expect(decideAlert({ threshold: 1.7, armed: true, lastTriggeredAt: recent }, 1.6, now)).toBeNull();
    const old = new Date(now.getTime() - 25 * 3_600_000);
    expect(decideAlert({ threshold: 1.7, armed: true, lastTriggeredAt: old }, 1.6, now)).toBe("trigger");
  });
});

describe("alertes à l'ingestion (base de test)", () => {
  const uid = "test-alert-user";
  let stationId: number;
  let minute = 0;
  // Chaque ingestion porte un horodatage plus récent, comme le flux réel.
  const withGazole = (price: number) => async (): Promise<RawStation[]> =>
    parseFr(readFileSync("test/fixtures/fr.xml")).map((s) => ({
      ...s, prices: s.prices.map((p) => ({ ...p, updatedAt: new Date(Date.now() - 3_600_000 + minute++ * 60_000), ...(p.fuel === "B7" ? { price } : {}) })),
    }));
  const count = async () => (await db.select().from(notification).where(and(eq(notification.userId, uid), eq(notification.type, "price_alert")))).length;

  beforeAll(async () => {
    await bootstrap();
    await db.delete(station);
    await db.delete(user).where(eq(user.id, uid));
    await db.insert(user).values({ id: uid, name: "Alerte", email: "alert@test.local", emailVerified: true, status: "active" });
    await runConnector(fr, withGazole(1.8));
    stationId = (await db.select().from(station).where(eq(station.externalId, "40500002")))[0].id;
    await db.insert(priceAlert).values({ userId: uid, scope: "station", stationId, fuelCode: "B7", threshold: 1.7 });
  });

  it("1,80 → 1,69 (seuil 1,70) puis 3 ingestions à 1,69 : une seule notification", async () => {
    await runConnector(fr, withGazole(1.8));
    expect(await count()).toBe(0);
    await runConnector(fr, withGazole(1.69));
    expect(await count()).toBe(1);
    for (let i = 0; i < 3; i++) await runConnector(fr, withGazole(1.69));
    expect(await count()).toBe(1);
  });

  it("repasse au-dessus : réarmée, mais pas de nouvelle notification avant 24 h", async () => {
    await runConnector(fr, withGazole(1.75));
    expect((await db.select().from(priceAlert).where(eq(priceAlert.userId, uid)))[0].armed).toBe(true);
    await runConnector(fr, withGazole(1.65));
    expect(await count()).toBe(1);
  });
});
