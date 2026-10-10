import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/db";
import { auditLog, ingestionRun, source, user } from "@/db/schema";
import { AdminSettingsForm, ConnectorActions, UserActions } from "@/components/AdminActions";
import { requireRole } from "@/lib/session";
import { getSetting } from "@/lib/settings";

const TABS = ["users", "settings", "connectors", "audit"] as const;

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const tab = TABS.find((x) => x === sp.tab) ?? "users";
  const t = await getTranslations("admin");
  const f = await getFormatter();
  const now = await getNow();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-4">
        <h1 className="mb-3 text-2xl font-semibold">{t("title")}</h1>
        <nav className="mb-4 flex gap-1 border-b border-border">
          {TABS.map((k) => (
            <Link key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-accent font-medium" : "border-transparent text-muted hover:text-fg"}`}>
              {t(k)}
            </Link>
          ))}
        </nav>

        {tab === "users" && await (async () => {
          const q = typeof sp.q === "string" ? sp.q.trim() : "";
          const status = typeof sp.status === "string" ? sp.status : "";
          const conds: SQL[] = [];
          if (q) conds.push(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`))!);
          if (status) conds.push(eq(user.status, status));
          const users = await db.select().from(user).where(conds.length ? and(...conds) : undefined).orderBy(desc(user.createdAt)).limit(200);
          return (
            <>
              <form className="mb-3 flex flex-wrap gap-2">
                <input type="hidden" name="tab" value="users" />
                <input className="input max-w-xs" name="q" defaultValue={q} placeholder={t("search")} aria-label={t("search")} />
                <select className="input w-auto" name="status" defaultValue={status} aria-label={t("status")}>
                  <option value="">—</option>
                  {(["pending_approval", "pending_verification", "active", "disabled"] as const).map((s) => <option key={s} value={s}>{t(`statuses.${s}`)}</option>)}
                </select>
                <button className="btn-ghost">OK</button>
              </form>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">{t("status")}</th>
                      <th className="px-3 py-2 font-medium">{t("role")}</th><th className="px-3 py-2 font-medium">{t("createdAt")}</th>
                      <th className="px-3 py-2 font-medium">{t("actions")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-3 py-2"><p>{u.email}</p><p className="text-xs text-muted">{u.name}</p></td>
                        <td className="px-3 py-2">{t(`statuses.${u.status}` as never)}</td>
                        <td className="px-3 py-2">{t(`roles.${u.role}` as never)}</td>
                        <td className="px-3 py-2 text-muted">{f.dateTime(u.createdAt, { dateStyle: "short" })}</td>
                        <td className="px-3 py-2">{u.id !== me.id && <UserActions u={{ id: u.id, status: u.status, role: u.role, emailVerified: u.emailVerified }} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {tab === "settings" && (
          <AdminSettingsForm domains={(await getSetting("allowed_email_domains")).join("\n")} requireApproval={await getSetting("require_admin_approval")} />
        )}

        {tab === "connectors" && await (async () => {
          const sources = await db.select().from(source).orderBy(source.country);
          const runs = await db.select().from(ingestionRun).orderBy(desc(ingestionRun.startedAt)).limit(60);
          return (
            <div className="space-y-3">
              {sources.map((s) => {
                const last = runs.find((r) => r.sourceId === s.id);
                const ok = s.consecutiveFailures === 0 && !!s.lastSuccessAt;
                return (
                  <div key={s.id} className="card flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                    <span className={`h-3 w-3 rounded-full ${ok ? "bg-tier-0" : s.consecutiveFailures >= 3 ? "bg-tier-2" : "bg-tier-1"}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.country} — {s.name}</p>
                      <p className="text-xs text-muted">
                        {t("lastSuccess")} : {s.lastSuccessAt ? f.relativeTime(s.lastSuccessAt, now) : t("never")}
                        {last && <> · {t("lastRun")} : {t(last.status as never)} ({last.stationsUpserted} {t("stations").toLowerCase()}, {last.pricesChanged} {t("prices").toLowerCase()}{last.finishedAt && `, ${Math.round((+last.finishedAt - +last.startedAt) / 1000)} s`})</>}
                        {s.consecutiveFailures > 0 && <> · {t("failures")} : {s.consecutiveFailures}</>}
                      </p>
                      {last?.error && <p className="truncate text-xs text-danger">{last.error}</p>}
                    </div>
                    <ConnectorActions id={s.id} enabled={s.enabled} />
                  </div>
                );
              })}
              <div className="card flex items-center gap-4 px-4 py-3 text-sm">
                <p className="flex-1 font-medium">FR — {t("osm")}</p>
                <ConnectorActions id="osm" />
              </div>
            </div>
          );
        })()}

        {tab === "audit" && await (async () => {
          const rows = await db.select({ a: auditLog, email: user.email }).from(auditLog).leftJoin(user, eq(user.id, auditLog.actorId))
            .orderBy(desc(auditLog.createdAt)).limit(200);
          return (
            <ul className="card divide-y divide-border text-sm">
              {rows.map(({ a, email }) => (
                <li key={a.id} className="px-4 py-2">
                  <span className="text-muted">{f.dateTime(a.createdAt, { dateStyle: "short", timeStyle: "short" })}</span> · {email ?? "—"} · <code>{a.action}</code> {a.targetType}:{a.targetId}
                  {a.data != null && <code className="ml-2 text-xs text-muted">{JSON.stringify(a.data)}</code>}
                </li>
              ))}
            </ul>
          );
        })()}
      </div>
    </div>
  );
}
