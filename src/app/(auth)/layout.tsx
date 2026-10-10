import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { Logo } from "@/components/Logo";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div>
              <p className="text-lg font-semibold leading-tight">{t("name")}</p>
              <p className="text-xs text-muted">{t("tagline")}</p>
            </div>
          </div>
          <LocaleSwitch />
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
