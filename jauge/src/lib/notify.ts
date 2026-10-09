import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notification, user } from "@/db/schema";

export async function notify(userId: string, type: string, payload: Record<string, unknown> = {}) {
  await db.insert(notification).values({ userId, type, payload });
}

export async function notifyAdmins(type: string, payload: Record<string, unknown> = {}) {
  const admins = await db.select({ id: user.id }).from(user).where(eq(user.role, "admin"));
  if (admins.length) await db.insert(notification).values(admins.map((a) => ({ userId: a.id, type, payload })));
}
