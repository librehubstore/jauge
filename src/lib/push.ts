import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscription, user } from "@/db/schema";
import { LOCALES, type Locale } from "@/i18n/config";

export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Envoie une notification push (texte traduit dans la langue de l'utilisateur) à tous ses appareils. */
export async function sendPush(userId: string, type: string, payload: Record<string, unknown>, url: string) {
  if (!pushEnabled()) return;
  const subs = await db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));
  if (!subs.length) return;
  configure();
  const [u] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, userId));
  const locale = (LOCALES as readonly string[]).includes(u?.locale ?? "") ? (u!.locale as Locale) : "fr";
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "notif" });
  const body = JSON.stringify({ title: "Jauge", body: t(type as never, payload as never), url });
  for (const s of subs) {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600 })
      .catch(async (e: { statusCode?: number }) => {
        // Abonnement expiré ou révoqué : on le supprime.
        if (e.statusCode === 404 || e.statusCode === 410) await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, s.endpoint));
        else console.error("[push]", e);
      });
  }
}
