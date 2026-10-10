import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { vehicle } from "@/db/schema";
import { FUEL_CODES } from "@/lib/fuels";
import { planRoute } from "@/lib/route-plan";
import { currentUser } from "@/lib/session";

const Point = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const Body = z.object({
  points: z.array(Point).min(2).max(5), // départ, ≤ 3 étapes, arrivée
  vehicleId: z.number().int().optional(),
  fuel: z.enum(FUEL_CODES as [string, ...string[]]).optional(),
  startLevel: z.number().min(0).max(1).default(0.25),
  reserve: z.number().min(0.05).max(0.5).default(0.15),
  corridorKm: z.number().min(1).max(20).default(5),
  avoidTolls: z.boolean().default(false),
  avoidHighways: z.boolean().default(false),
});

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "BAD_REQUEST" }, { status: 400 });
  const [v] = await db.select().from(vehicle).where(and(
    eq(vehicle.userId, u.id), b.data.vehicleId ? eq(vehicle.id, b.data.vehicleId) : eq(vehicle.isDefault, true),
  ));
  try {
    const result = await planRoute({
      ...b.data, fuel: b.data.fuel ?? v?.fuelCode ?? u.preferences.defaultFuel ?? "B7",
      tank: v?.tankCapacity ?? 50, consumption: v?.consumptionPer100km ?? 6,
    });
    return Response.json(result);
  } catch (e) {
    console.error("[route]", e);
    return Response.json({ error: "ROUTING_FAILED" }, { status: 502 });
  }
}
