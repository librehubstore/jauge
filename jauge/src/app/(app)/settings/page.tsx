import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { PreferencesForm } from "@/components/PreferencesForm";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const u = await requireUser();
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="card flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">{t("language")}</span>
          <LocaleSwitch />
        </div>
        <PreferencesForm prefs={u.preferences} />
        <p className="text-sm"><Link className="text-accent hover:underline" href="/about">{tn("about")}</Link></p>
      </div>
    </div>
  );
}
