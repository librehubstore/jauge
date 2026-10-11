"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  resendVerification, runOsmNow, runSourceNow, saveAdminSettings, sendPasswordReset, setSourceEnabled, setUserRole, setUserStatus, testMail, testPush,
} from "@/app/actions/admin";

export function UserActions({ u }: { u: { id: string; status: string; role: string; emailVerified: boolean } }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setDone(true); });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {u.status === "pending_approval" && <button className="btn-primary px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setUserStatus(u.id, "active"))}>{t("approve")}</button>}
      {u.status === "active" && <button className="btn-danger px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setUserStatus(u.id, "disabled"))}>{t("disable")}</button>}
      {u.status === "disabled" && <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => setUserStatus(u.id, "active"))}>{t("enable")}</button>}
      <select className="rounded-md border border-border bg-surface px-1.5 py-1 text-xs" defaultValue={u.role} disabled={pending} aria-label={t("role")}
        onChange={(e) => run(() => setUserRole(u.id, e.target.value))}>
        {(["user", "moderator", "admin"] as const).map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
      </select>
      {u.emailVerified
        ? <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => sendPasswordReset(u.id))}>{t("sendReset")}</button>
        : <button className="btn-ghost px-2 py-1 text-xs" disabled={pending} onClick={() => run(() => resendVerification(u.id))}>{t("resendVerification")}</button>}
      {done && <span className="text-xs text-muted" role="status">✓</span>}
    </div>
  );
}

export function AdminSettingsForm({ domains, requireApproval }: { domains: string; requireApproval: boolean }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <form className="card max-w-xl space-y-4 p-4" onChange={() => setSaved(false)} onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        await saveAdminSettings({ allowedDomains: String(f.get("domains") ?? ""), requireApproval: f.get("approval") === "on" });
        setSaved(true);
      });
    }}>
      <label className="block"><span className="label">{t("allowedDomains")}</span>
        <textarea className="input font-mono" name="domains" rows={4} defaultValue={domains} placeholder="exemple.eu" /></label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approval" defaultChecked={requireApproval} /> {t("requireApproval")}
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{tc("save")}</button>
        {saved && <span role="status" className="text-sm text-muted">✓</span>}
      </div>
    </form>
  );
}

export function ConnectorActions({ id, enabled }: { id: string; enabled?: boolean }) {
  const t = useTranslations("admin");
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  return (
    <div className="flex items-center gap-3">
      {enabled !== undefined && (
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" defaultChecked={enabled} disabled={pending} onChange={(e) => start(() => setSourceEnabled(id, e.target.checked))} />
          {t("enabled")}
        </label>
      )}
      <button className="btn-ghost px-2 py-1 text-xs" disabled={pending || queued}
        onClick={() => start(async () => { await (id === "osm" ? runOsmNow() : runSourceNow(id)); setQueued(true); })}>
        {queued ? t("queued") : t("runNow")}
      </button>
    </div>
  );
}

/** Envoi d'une notification push et d'un email de test à l'administrateur connecté. */
export function SendTests({ email }: { email: string }) {
  const t = useTranslations("admin.tests");
  const [pending, start] = useTransition();
  const [push, setPush] = useState<Awaited<ReturnType<typeof testPush>> | null>(null);
  const [mail, setMail] = useState<Awaited<ReturnType<typeof testMail>> | null>(null);
  // Vert : envoyé ; rouge : échec ; orange : configuration à compléter.
  const tone = (s: string) => `text-sm ${s === "sent" ? "text-tier-0" : s === "failed" ? "text-danger" : "text-tier-1"}`;
  return (
    <section className="card max-w-xl space-y-4 p-4">
      <h2 className="font-semibold">{t("title")}</h2>
      <div className="space-y-1.5">
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => setPush(await testPush()))}>{t("push")}</button>
        <p className="text-xs text-muted">{t("pushHelp")}</p>
        {push && <p role="status" className={tone(push.status)}>{t(`push_${push.status}`, { count: push.sent })}</p>}
      </div>
      <div className="space-y-1.5">
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => setMail(await testMail()))}>{t("mail")}</button>
        <p className="text-xs text-muted">{t("mailHelp", { email })}</p>
        {mail && <p role="status" className={tone(mail)}>{t(`mail_${mail}`, { email })}</p>}
      </div>
    </section>
  );
}
