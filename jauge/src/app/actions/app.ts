"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { favorite, notification, priceAlert, pushSubscription, user, vehicle, type Preferences } from "@/db/schema";
import { PAYLOADS, submitContribution, type ContributionType } from "@/lib/contributions";
import { FUEL_CODES } from "@/lib/fuels";
import { DISPLAY_CURRENCIES } from "@/lib/fx";
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
  emailAlerts: z.boolean().optional(),
  displayCurrency: z.enum(["", ...DISPLAY_CURRENCIES]).optional(),
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

const AlertInput = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("station"), stationId: z.coerce.number().int(), fuelCode: fuel, threshold: z.coerce.number().min(0.1).max(20) }),
  z.object({ scope: z.literal("favorites"), fuelCode: fuel, threshold: z.coerce.number().min(0.1).max(20) }),
  z.object({
    scope: z.literal("area"), fuelCode: fuel, threshold: z.coerce.number().min(0.1).max(20),
    lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().min(1).max(50), label: z.string().trim().max(160),
  }),
]);

export async function createAlert(input: z.input<typeof AlertInput>) {
  const u = await requireUser();
  const a = AlertInput.parse(input);
  await db.insert(priceAlert).values({
    userId: u.id, scope: a.scope, fuelCode: a.fuelCode, threshold: a.threshold,
    stationId: a.scope === "station" ? a.stationId : null,
    center: a.scope === "area" ? { x: a.lon, y: a.lat } : null,
    radiusKm: a.scope === "area" ? a.radiusKm : null,
    label: a.scope === "area" ? a.label : null,
  });
  revalidatePath("/alerts");
}

export async function setAlertActive(id: number, active: boolean) {
  const u = await requireUser();
  await db.update(priceAlert).set({ active, armed: true }).where(and(eq(priceAlert.id, id), eq(priceAlert.userId, u.id)));
  revalidatePath("/alerts");
}

export async function deleteAlert(id: number) {
  const u = await requireUser();
  await db.delete(priceAlert).where(and(eq(priceAlert.id, id), eq(priceAlert.userId, u.id)));
  revalidatePath("/alerts");
}

const PushInput = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

export async function savePushSubscription(sub: z.input<typeof PushInput>) {
  const u = await requireUser();
  const p = PushInput.parse(sub);
  await db.insert(pushSubscription).values({ endpoint: p.endpoint, userId: u.id, p256dh: p.keys.p256dh, auth: p.keys.auth })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId: u.id, p256dh: p.keys.p256dh, auth: p.keys.auth } });
}

export async function deletePushSubscription(endpoint: string) {
  const u = await requireUser();
  await db.delete(pushSubscription).where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, u.id)));
}
