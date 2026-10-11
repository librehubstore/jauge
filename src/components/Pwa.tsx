"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/app";

const SW_ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW === "1";

/**
 * Enregistre le service worker (production, ou NEXT_PUBLIC_SW=1 en développement).
 * En développement, désinstalle un service worker resté d'un test en production : il servirait
 * d'anciens fichiers /_next/static et provoquerait des rechargements en boucle.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (SW_ENABLED) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
      return;
    }
    (async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (!regs.length) return;
      await Promise.all(regs.map((r) => r.unregister()));
      for (const k of await caches.keys()) if (k.startsWith("jauge-")) await caches.delete(k);
      location.reload();
    })().catch(() => {});
  }, []);
  return null;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

/** Bandeau affiché tant que le navigateur est hors ligne. */
export function OfflineBanner() {
  const t = useTranslations("pwa");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (online) return null;
  return <p role="status" className="bg-tier-1 px-3 py-1.5 text-center text-sm text-white">{t("offline")}</p>;
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

// Choix mémorisé par appareil : désactivé à la main = plus d'abonnement automatique ; permission demandée une seule fois.
const PUSH_OFF = "jauge.push.off", PUSH_ASKED = "jauge.push.asked";
const local = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* stockage indisponible */ } },
};
const pushSupported = (key: string | null): key is string =>
  SW_ENABLED && !!key && "serviceWorker" in navigator && "PushManager" in window;

/** Abonne cet appareil (ou réutilise son abonnement) et l'enregistre pour l'utilisateur connecté. */
async function subscribePush(key: string) {
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await savePushSubscription({ endpoint: j.endpoint, keys: j.keys });
}

/**
 * Push activé par défaut : abonne l'appareil si la permission est déjà accordée, sinon la demande
 * au premier geste de l'utilisateur (une fois par appareil ; le navigateur exige un geste).
 */
export function AutoPush({ vapidKey }: { vapidKey: string | null }) {
  useEffect(() => {
    if (!pushSupported(vapidKey) || local.get(PUSH_OFF)) return;
    if (Notification.permission === "granted") { subscribePush(vapidKey).catch(() => {}); return; }
    if (Notification.permission !== "default" || local.get(PUSH_ASKED)) return;
    const ask = () => {
      local.set(PUSH_ASKED, "1");
      Notification.requestPermission().then((p) => (p === "granted" ? subscribePush(vapidKey) : undefined)).catch(() => {});
    };
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, [vapidKey]);
  return null;
}

/** Activation des notifications push sur cet appareil ; vapidKey est fournie par le serveur (null si le push n'est pas configuré). */
export function PushToggle({ vapidKey: key }: { vapidKey: string | null }) {
  const t = useTranslations("pwa");
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "loading">("loading");

  useEffect(() => {
    (async () => {
      if (!pushSupported(key)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    setState("loading");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      await subscribePush(key!);
      local.set(PUSH_OFF, null);
      setState("on");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("loading");
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) { await deletePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    local.set(PUSH_OFF, "1");
    setState("off");
  }

  if (state === "unsupported") return <p className="text-sm text-muted">{t("unsupported")}</p>;
  if (state === "denied") return <p className="text-sm text-muted">{t("denied")}</p>;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm">{state === "on" ? t("on") : t("off")}</p>
      <button type="button" className="btn-ghost" disabled={state === "loading"} onClick={state === "on" ? disable : enable}>
        {state === "on" ? t("disable") : t("enable")}
      </button>
    </div>
  );
}
