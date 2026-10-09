"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorite, notification, user, vehicle, type Preferences } from "@/db/schema";
import { PAYLOADS, submitContribution, type ContributionType } from "@/lib/contributions";
import { FUEL_CODES } from "@/lib/fuels";
import { requireUser } from "@/lib/session";

const fuel = z.enum(FUEL_CODES as [string, ...string[]]);

export async function setFavorite(stationId: number, on: boolean) {
  const u = await requireUser();
  if (on) await db.insert(favorite).values({ userId: u.id, stationId }).onConflictDoNothing();
  else await db.delete(favorite).where(and(eq(favorite.userId, u.id), eq(favorite.stationId, stationId)));
  revalidatePath("/favorites");
}

const VehicleInput = z.object({
  id: z.coerce.number().optional(),
  name: z.string().trim().min(1).max(60),
  fuelCode: fuel,
  secondaryFuelCode: fuel.or(z.literal("")).optional().transform((v) => v || null),
  tankCapacity: z.coerce.number().min(1).max(2000),
  consumptionPer100km: z.coerce.number().min(0.1).max(100),
  isDefault: z.coerce.boolean().optional(),
});

export async function saveVehicle(input: z.input<typeof VehicleInput>) {
  const u = await requireUser();
  const v = VehicleInput.parse(input);
  const mine = await db.select({ id: vehicle.id }).from(vehicle).where(eq(vehicle.userId, u.id));
  const isDefault = v.isDefault || mine.length === 0 || (mine.length === 1 && mine[0].id === v.id);
  const data = { ...v, userId: u.id, isDefault };
  const [saved] = v.id
    ? await db.update(vehicle).set(data).where(and(eq(vehicle.id, v.id), eq(vehicle.userId, u.id))).returning()
    : await db.insert(vehicle).values(data).returning();
  if (saved && isDefault) {
    await db.update(vehicle).set({ isDefault: false }).where(and(eq(vehicle.userId, u.id), ne(vehicle.id, saved.id)));
  }
  revalidatePath("/vehicles");
  return saved?.id;
}

export async function setDefaultVehicle(id: number) {
  const u = await requireUser();
  await db.update(vehicle).set({ isDefault: false }).where(eq(vehicle.userId, u.id));
  await db.update(vehicle).set({ isDefault: true }).where(and(eq(vehicle.id, id), eq(vehicle.userId, u.id)));
  revalidatePath("/vehicles");
}

export async function deleteVehicle(id: number) {
  const u = await requireUser();
  const [gone] = await db.delete(vehicle).where(and(eq(vehicle.id, id), eq(vehicle.userId, u.id))).returning();
  if (gone?.isDefault) {
    const [next] = await db.select().from(vehicle).where(eq(vehicle.userId, u.id)).limit(1);
    if (next) await db.update(vehicle).set({ isDefault: true }).where(eq(vehicle.id, next.id));
  }
  revalidatePath("/vehicles");
}

const PrefsInput = z.object({
  distanceUnit: z.enum(["km", "mi"]).optional(),
  defaultFuel: fuel.optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  navApp: z.enum(["google", "apple", "waze", "osm"]).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
});

export async function savePreferences(input: Preferences) {
  const u = await requireUser();
  const prefs = { ...u.preferences, ...PrefsInput.parse(input) };
  await db.update(user).set({ preferences: prefs }).where(eq(user.id, u.id));
  revalidatePath("/", "layout");
}

/** Contribution (rupture, prix, fermeture, enseigne, horaires, station manquante) — spec 4.10. */
export async function contribute(stationId: number | null, type: ContributionType, payload: unknown) {
  const u = await requireUser();
  if (!(type in PAYLOADS)) throw new Error("BAD_TYPE");
  const c = await submitContribution(u.id, stationId, type, payload);
  if (stationId) revalidatePath(`/station/${stationId}`);
  return c.status;
}

export async function markNotificationsRead() {
  const u = await requireUser();
  await db.update(notification).set({ readAt: new Date() }).where(and(eq(notification.userId, u.id), isNull(notification.readAt)));
  revalidatePath("/", "layout");
}
