import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notification, user } from "@/db/schema";
import { sendPush } from "./push";

/** Types également envoyés en push (si l'utilisateur l'a autorisé), avec la page à ouvrir. */
const PUSH: Record<string, (p: Record<string, unknown>) => string> = {
  price_alert: (p) => `/station/${p.stationId}`,
  account_pending_approval: () => "/admin?tab=users&status=pending_approval",
};

export async function notify(userId: string, type: string, payload: Record<string, unknown> = {}) {
  await db.insert(notification).values({ userId, type, payload });
  if (PUSH[type]) await sendPush(userId, type, payload, PUSH[type](payload)).catch((e) => console.error("[push]", e));
}

export async function notifyAdmins(type: string, payload: Record<string, unknown> = {}) {
  const admins = await db.select({ id: user.id }).from(user).where(eq(user.role, "admin"));
  for (const a of admins) await notify(a.id, type, payload);
}
