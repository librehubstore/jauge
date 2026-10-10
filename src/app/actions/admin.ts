"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { connectorById } from "@/connectors";
import { enrichFrBrandsFromOsm } from "@/connectors/osm-brands";
import { db } from "@/db";
import { auditLog, session, source, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { moderate } from "@/lib/contributions";
import { runConnector } from "@/lib/ingest";
import { notify } from "@/lib/notify";
import { requireRole } from "@/lib/session";
import { setSetting } from "@/lib/settings";

async function audit(actorId: string, action: string, targetType: string, targetId: string | null, data?: unknown) {
  await db.insert(auditLog).values({ actorId, action, targetType, targetId, data: data ?? null });
}

export async function setUserStatus(userId: string, status: "active" | "disabled") {
  const admin = await requireRole("admin");
  if (userId === admin.id) return;
  const [before] = await db.select().from(user).where(eq(user.id, userId));
  if (!before) return;
  await db.update(user).set({ status }).where(eq(user.id, userId));
  if (status === "disabled") await db.delete(session).where(eq(session.userId, userId));
  if (status === "active" && before.status === "pending_approval") await notify(userId, "account_approved");
  await audit(admin.id, `user.${status === "active" ? "activate" : "disable"}`, "user", userId, { from: before.status });
  revalidatePath("/admin");
}

export async function setUserRole(userId: string, role: string) {
  const admin = await requireRole("admin");
  const r = z.enum(["user", "moderator", "admin"]).parse(role);
  if (userId === admin.id) return;
  await db.update(user).set({ role: r }).where(eq(user.id, userId));
  await audit(admin.id, "user.role", "user", userId, { role: r });
  revalidatePath("/admin");
}

export async function sendPasswordReset(userId: string) {
  const admin = await requireRole("admin");
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) return;
  await auth.api.requestPasswordReset({ body: { email: u.email, redirectTo: "/reset" }, headers: await headers() });
  await audit(admin.id, "user.reset_password", "user", userId);
}

export async function resendVerification(userId: string) {
  const admin = await requireRole("admin");
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u || u.emailVerified) return;
  await auth.api.sendVerificationEmail({ body: { email: u.email, callbackURL: "/verify" }, headers: await headers() });
  await audit(admin.id, "user.resend_verification", "user", userId);
}

export async function saveAdminSettings(input: { allowedDomains: string; requireApproval: boolean }) {
  const admin = await requireRole("admin");
  const domains = [...new Set(input.allowedDomains.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
  await setSetting("allowed_email_domains", domains);
  await setSetting("require_admin_approval", !!input.requireApproval);
  await audit(admin.id, "settings.update", "setting", null, { domains, requireApproval: !!input.requireApproval });
  revalidatePath("/admin");
}

export async function setSourceEnabled(id: string, enabled: boolean) {
  const admin = await requireRole("admin");
  await db.update(source).set({ enabled }).where(eq(source.id, id));
  await audit(admin.id, "source.enable", "source", id, { enabled });
  revalidatePath("/admin");
}

/** Lance un connecteur après la réponse HTTP (le worker reste la voie planifiée normale). */
export async function runSourceNow(id: string) {
  const admin = await requireRole("admin");
  const c = connectorById(id);
  if (!c) return;
  await audit(admin.id, "source.run", "source", id);
  after(() => runConnector(c).catch((e) => console.error(`[ingest] ${id}`, e)));
}

export async function runOsmNow() {
  const admin = await requireRole("admin");
  await audit(admin.id, "osm.run", "source", "osm");
  after(() => enrichFrBrandsFromOsm().then((r) => console.info("[osm]", r)).catch((e) => console.error("[osm]", e)));
}

export async function moderateContribution(id: number, decision: "approve" | "reject", reason?: string) {
  const mod = await requireRole("moderator", "admin");
  const status = await moderate(id, mod.id, decision, reason?.trim().slice(0, 300));
  if (status) await audit(mod.id, `contribution.${decision}`, "contribution", String(id), { reason });
  revalidatePath("/moderation");
}
