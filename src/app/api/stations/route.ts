import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vehicle } from "@/db/schema";
import { FUEL_CODES } from "@/lib/fuels";
import { refreshRomaniaArea } from "@/lib/ro-live";
import { searchStations } from "@/lib/search";
import { currentUser } from "@/lib/session";

const bool = (d: boolean) => z.enum(["0", "1"]).optional().transform((v) => (v === undefined ? d : v === "1"));
const ids = z.string().optional().transform((v) => (v ? v.split(",").map(Number).filter(Number.isFinite) : []));

const Q = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).default(10),
  fuel: z.enum(FUEL_CODES as [string, ...string[]]),
  sort: z.enum(["best", "price", "fill", "distance"]).default("best"),
  level: z.coerce.number().min(0).max(1).default(0.25),
  vehicleId: z.coerce.number().optional(),
  onlySelling: bool(true), hideOutages: bool(false), openNow: bool(false), automat24: bool(false),
  includeOld: bool(false), favoritesFirst: bool(false),
  brands: ids, excludeBrands: ids,
  services: z.string().optional().transform((v) => (v ? v.split(",") : [])),
});

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  const q = parsed.data;

  // Véhicule choisi, sinon véhicule par défaut, sinon valeurs génériques (50 L, 6 L/100 km).
  const [v] = await db.select().from(vehicle).where(and(
    eq(vehicle.userId, u.id), q.vehicleId ? eq(vehicle.id, q.vehicleId) : eq(vehicle.isDefault, true),
  ));
  // Roumanie : la source ne répond que par petites zones, rafraîchies à la demande.
  await refreshRomaniaArea(q.lat, q.lon, q.radius);
  // La position sert à la requête et n'est jamais stockée (RGPD).
  const result = await searchStations({
    lat: q.lat, lon: q.lon, radiusKm: q.radius, fuel: q.fuel, sort: q.sort, level: q.level,
    tank: v?.tankCapacity ?? 50, consumption: v?.consumptionPer100km ?? 6,
    onlySelling: q.onlySelling, hideOutages: q.hideOutages, openNow: q.openNow, automat24: q.automat24,
    includeOld: q.includeOld, favoritesFirst: q.favoritesFirst, brands: q.brands, excludeBrands: q.excludeBrands,
    services: q.services, userId: u.id, maxAgeDays: u.preferences.maxPriceAgeDays,
  });
  return Response.json(result, { headers: { "Cache-Control": "private, max-age=60" } });
}
