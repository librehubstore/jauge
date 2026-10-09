import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEs, parseHorario } from "@/connectors/es";
import { parseFr } from "@/connectors/fr";
import { mapItFuel, parseIt } from "@/connectors/it";
import { amountToAdd, bestChoiceCost, freshness, median, priceTiers, savings } from "@/lib/cost";
import { isAberrant } from "@/lib/ingest";
import { hashPassword, isCommonPassword, verifyPassword } from "@/lib/password";
import { emailDomainAllowed } from "@/lib/settings";
import { parseDmyLocal, parseIsoLocal } from "@/lib/time";

const fx = (f: string) => readFileSync(`test/fixtures/${f}`);

describe("connecteur FR", () => {
  const rows = parseFr(fx("fr.xml"));
  it("convertit les coordonnées PTV en WGS84 et lit les prix horodatés", () => {
    expect(rows).toHaveLength(3);
    const s = rows[0];
    expect(s.externalId).toBe("40500002");
    expect(s.lat).toBeCloseTo(43.773, 3);
    expect(s.lon).toBeCloseTo(-0.567, 3);
    expect(s.roadType).toBe("road");
    expect(s.is24hAutomat).toBe(true);
    const gazole = s.prices.find((p) => p.fuel === "B7")!;
    expect(gazole.price).toBe(2.319);
    // 08:54:39 heure de Paris (CEST) = 06:54:39 UTC
    expect(gazole.updatedAt.toISOString()).toBe("2026-10-07T06:54:39.000Z");
  });
  it("décode l'ISO-8859-1, normalise services et ruptures", () => {
    expect(rows[0].services).toEqual(expect.arrayContaining(["inflation", "truck", "wash", "lpg_bottle", "card24", "atm"]));
    expect(rows[0].outages).toEqual(expect.arrayContaining([expect.objectContaining({ fuel: "E85", kind: "permanent" })]));
    expect(rows[0].hours).toHaveLength(7);
  });
});

describe("connecteur ES", () => {
  const rows = parseEs(JSON.parse(fx("es.json").toString()));
  it("lit prix à virgule, enseigne et horaires simples", () => {
    expect(rows).toHaveLength(3);
    expect(rows[0].is24hAutomat).toBe(true);
    const r = rows.find((s) => s.externalId === "5122")!;
    expect(r.brand).toBe("REPSOL");
    expect(r.prices.find((p) => p.fuel === "B7_PREMIUM")!.price).toBe(2.089);
    expect(r.lat).toBeCloseTo(39.100389, 5);
    expect(r.hours?.[0]).toEqual({ weekday: 0, opens: "07:00", closes: "23:00", isClosed: false });
  });
  it("ignore les horaires complexes", () => {
    expect(parseHorario("L-V: 06:00-22:00; S: 08:00-14:00")).toEqual({ is24: false });
  });
});

describe("connecteur IT", () => {
  const rows = parseIt(fx("it_anagrafica.csv").toString(), fx("it_prezzi.csv").toString());
  it("joint anagrafica et prix, préfère le libre-service", () => {
    const s = rows.find((r) => r.externalId === "59183")!;
    expect(s.brand).toBe("Agip Eni");
    expect(s.prices.find((p) => p.fuel === "E5")!.price).toBe(1.99);
    expect(s.prices.find((p) => p.fuel === "XTL")!.price).toBe(2.21);
  });
  it("regroupe les dénominations commerciales", () => {
    expect(mapItFuel("Blue Diesel")).toBe("B7_PREMIUM");
    expect(mapItFuel("HVOlution")).toBe("XTL");
    expect(mapItFuel("Blue Super")).toBe("E5_98");
    expect(mapItFuel("Metano")).toBe("CNG");
  });
});

describe("calculs de coût (spec 4.5)", () => {
  it("une station moins chère de 0,02 €/L à 15 km ne bat pas une station à 1 km pour 30 L", () => {
    const near = bestChoiceCost(1.8, 30, 1, 6);
    const far = bestChoiceCost(1.78, 30, 15, 6);
    expect(near).toBeLessThan(far);
  });
  it("litres à ajouter et économie", () => {
    expect(amountToAdd(50, 0.25)).toBe(37.5);
    expect(savings(1.9, 1.8, 30, 0, 6)).toBeCloseTo(3, 5);
  });
  it("fraîcheur : ancien après 48 h, exclu après 7 jours", () => {
    const now = new Date("2026-10-09T12:00:00Z");
    expect(freshness(new Date("2026-10-09T00:00:00Z"), now)).toBe("fresh");
    expect(freshness(new Date("2026-10-06T00:00:00Z"), now)).toBe("stale");
    expect(freshness(new Date("2026-09-30T00:00:00Z"), now)).toBe("excluded");
  });
  it("médiane, tiers et prix aberrants", () => {
    expect(median([3, 1, 2])).toBe(2);
    const tier = priceTiers([1, 2, 3, 4, 5, 6]);
    expect([tier(1), tier(4), tier(6)]).toEqual([0, 1, 2]);
    expect(isAberrant(0.3, 1.8)).toBe(true);
    expect(isAberrant(1.7, 1.8)).toBe(false);
  });
});

describe("fuseaux horaires", () => {
  it("heure d'hiver et d'été", () => {
    expect(parseIsoLocal("2026-01-15 12:00:00", "Europe/Paris")!.toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(parseDmyLocal("08/10/2026 07:49:13", "Europe/Rome")!.toISOString()).toBe("2026-10-08T05:49:13.000Z");
  });
});

describe("authentification", () => {
  it("argon2id : hachage et vérification", async () => {
    const h = await hashPassword("un mot de passe solide");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash: h, password: "un mot de passe solide" })).toBe(true);
    expect(await verifyPassword({ hash: h, password: "mauvais" })).toBe(false);
  });
  it("refuse les mots de passe courants", () => {
    expect(isCommonPassword("Password1234")).toBe(true);
    expect(isCommonPassword("aaaaaaaaaaaaaa")).toBe(true);
    expect(isCommonPassword("cheval-agrafe-batterie")).toBe(false);
  });
  it("domaines autorisés", () => {
    expect(emailDomainAllowed("x@gmail.com", ["acme.eu"])).toBe(false);
    expect(emailDomainAllowed("x@ACME.eu", ["acme.eu"])).toBe(true);
    expect(emailDomainAllowed("x@gmail.com", [])).toBe(true);
  });
});

import { rank, type SearchParams } from "@/lib/search";

describe("recherche (spec 4.3)", () => {
  const base: SearchParams = {
    lat: 48.85, lon: 2.35, radiusKm: 10, fuel: "B7", sort: "best", level: 0.25, tank: 50, consumption: 6,
    onlySelling: true, hideOutages: false, openNow: false, automat24: false, includeOld: false,
    brands: [], excludeBrands: [], services: [], favoritesFirst: false, userId: "u",
  };
  const now = new Date("2026-10-09T12:00:00Z");
  const row = (id: number, price: string | null, km: number, extra = {}) => ({
    id, name: null, brand: null, brand_origin: null, address: null, city: null, country: "FR", lat: 48.85, lon: 2.35,
    distance_km: km, status: "active", is_24h_automat: true, services: [], brand_id: null, favorite: false,
    price, currency: "EUR", source_updated_at: price ? new Date("2026-10-09T08:00:00Z") : null, origin: "official",
    quarantined: false, outage: false, hours: null, ...extra,
  });

  it("une station sans B7 n'apparaît pas pour un véhicule B7", () => {
    const { stations } = rank([row(1, null, 1), row(2, "1.800", 2)], base, now);
    expect(stations.map((s) => s.id)).toEqual([2]);
  });
  it("le meilleur choix intègre le détour", () => {
    const { stations } = rank([row(1, "1.780", 15), row(2, "1.800", 1)], base, now);
    expect(stations[0].id).toBe(2);
    expect(rank([row(1, "1.780", 15), row(2, "1.800", 1)], { ...base, sort: "price" }, now).stations[0].id).toBe(1);
  });
  it("un prix de plus de 7 jours est exclu, sauf option", () => {
    const old = row(3, "1.500", 1, { source_updated_at: new Date("2026-09-20T00:00:00Z") });
    expect(rank([old], base, now).stations).toHaveLength(0);
    expect(rank([old], { ...base, includeOld: true }, now).stations).toHaveLength(1);
  });
  it("prix en quarantaine ignoré, rupture masquable", () => {
    expect(rank([row(4, "0.200", 1, { quarantined: true })], base, now).stations).toHaveLength(0);
    expect(rank([row(5, "1.8", 1, { outage: true })], { ...base, hideOutages: true }, now).stations).toHaveLength(0);
  });
});

import { parseFrArchiveLines } from "@/lib/history-import";
import { priceAt, trendOf } from "@/lib/trend";

describe("historique (spec 4.9)", () => {
  const day = 86_400_000, now = Date.UTC(2026, 9, 10);
  it("prix en vigueur à une date et tendance 7 jours", () => {
    const s: [number, number][] = [[now - 20 * day, 1.8], [now - 3 * day, 1.85]];
    expect(priceAt(s, now - 10 * day)).toBe(1.8);
    expect(trendOf(s, now)).toBe("up");
    expect(trendOf([[now - 20 * day, 1.8], [now - 2 * day, 1.795]], now)).toBe("stable");
    expect(trendOf([[now - 20 * day, 1.8], [now - 2 * day, 1.7]], now)).toBe("down");
    expect(trendOf([[now - 2 * day, 1.7]], now)).toBeNull();
  });
  it("archive FR : seuls les changements de prix après la date de début sont gardés", () => {
    const lines = [
      `<pdv id="1000001" latitude="4620100" longitude="519800" cp="01000" pop="R">`,
      `  <prix nom="Gazole" id="1" maj="2026-01-02T00:39:00" valeur="1.638"/>`,
      `  <prix nom="Gazole" id="1" maj="2026-01-02T08:18:00" valeur="1.638"/>`,
      `  <prix nom="Gazole" id="1" maj="2026-01-03T00:40:00" valeur="1.649"/>`,
      `  <prix nom="SP98" id="6" maj="2025-12-31T10:00:00" valeur="1.9"/>`,
      `</pdv>`,
    ];
    const pts = [...parseFrArchiveLines(lines, new Date("2026-01-01T00:00:00Z"))];
    expect(pts.map((p) => [p.fuel, p.price])).toEqual([["B7", 1.638], ["B7", 1.649]]);
    expect(pts[0].at.toISOString()).toBe("2026-01-01T23:39:00.000Z");
  });
});
