"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES } from "@/i18n/config";

const NAMES: Record<string, string> = { fr: "Français", en: "English" };

export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="sr-only">{t("language")}</span>
      <select
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
        value={locale}
        disabled={pending}
        onChange={(e) => start(async () => { await setLocale(e.target.value); router.refresh(); })}
      >
        {LOCALES.map((l) => <option key={l} value={l}>{NAMES[l]}</option>)}
      </select>
    </label>
  );
}
