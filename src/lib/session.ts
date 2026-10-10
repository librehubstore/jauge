import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "./auth";

/** Utilisateur courant relu en base (statut et rôle à jour), ou null. */
export const currentUser = cache(async () => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const [u] = await db.select().from(user).where(eq(user.id, s.user.id));
  return u?.status === "active" ? u : null;
});

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: string[]) {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/");
  return u;
}
