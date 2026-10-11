import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { PreferencesForm } from "@/components/PreferencesForm";
import { PushToggle } from "@/components/Pwa";
import { pushEnabled, vapidPublicKey } from "@/lib/push";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const u = await requireUser();
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");
  const tp = await getTranslations("pwa");
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="card flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium">{t("language")}</span>
          <LocaleSwitch />
        </div>
        <PreferencesForm prefs={u.preferences} />
        <div className="card space-y-2 px-4 py-3">
          <h2 className="text-sm font-medium">{tp("title")}</h2>
          <PushToggle vapidKey={pushEnabled() ? vapidPublicKey() : null} />
        </div>
        <p className="text-sm"><Link className="text-accent hover:underline" href="/about">{tn("about")}</Link></p>
      </div>
    </div>
  );
}
