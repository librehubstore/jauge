import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { source } from "@/db/schema";
import { requireUser } from "@/lib/session";

export default async function AboutPage() {
  await requireUser();
  const t = await getTranslations("about");
  const sources = await db.select().from(source).orderBy(source.country);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm">{t("body")}</p>
        <h2 className="font-semibold">{t("sources")}</h2>
        <ul className="card divide-y divide-border text-sm">
          {sources.map((s) => (
            <li key={s.id} className="px-4 py-2.5">
              <p className="font-medium">{s.country} — {s.name}</p>
              <p className="text-muted">
                {s.url ? <a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.attribution}</a> : s.attribution} · {s.license}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">{t("osm")}</p>
      </div>
    </div>
  );
}
