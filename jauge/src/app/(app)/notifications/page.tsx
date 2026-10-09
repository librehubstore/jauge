import { desc, eq } from "drizzle-orm";
import { getFormatter, getNow, getTranslations } from "next-intl/server";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { MarkRead } from "@/components/MarkRead";
import { requireUser } from "@/lib/session";

export default async function NotificationsPage() {
  const u = await requireUser();
  const t = await getTranslations("notif");
  const tn = await getTranslations("nav");
  const f = await getFormatter();
  const now = await getNow();
  const items = await db.select().from(notification).where(eq(notification.userId, u.id)).orderBy(desc(notification.createdAt)).limit(100);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">{tn("notifications")}</h1>
        <MarkRead hasUnread={items.some((i) => !i.readAt)} />
        {items.length === 0 ? <p className="text-sm text-muted">{t("empty")}</p> : (
          <ul className="card divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={`px-4 py-3 text-sm ${n.readAt ? "text-muted" : ""}`}>
                <p>{t.has(n.type) ? (t as unknown as (k: string, v: object) => string)(n.type, n.payload as object) : n.type}</p>
                <p className="text-xs text-muted">{f.relativeTime(n.createdAt, now)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
