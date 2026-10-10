"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";
import { currentUser } from "@/lib/session";

export async function setLocale(locale: string) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  const u = await currentUser();
  if (u) await db.update(user).set({ locale }).where(eq(user.id, u.id));
}
