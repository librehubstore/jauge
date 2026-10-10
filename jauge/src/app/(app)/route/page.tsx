import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicle } from "@/db/schema";
import { RoutePlanner } from "@/components/RoutePlanner";
import { requireUser } from "@/lib/session";

export default async function RoutePage() {
  const u = await requireUser();
  const vehicles = await db.select().from(vehicle).where(eq(vehicle.userId, u.id));
  return <RoutePlanner vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, fuelCode: v.fuelCode, isDefault: v.isDefault }))} />;
}
