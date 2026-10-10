import { and, count, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { SignOutButton } from "@/components/SignOutButton";
import { FxProvider } from "@/components/FxContext";
import { requireUser } from "@/lib/session";
import { getSetting } from "@/lib/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const u = await requireUser();
  const t = await getTranslations("nav");
  const [{ n }] = await db.select({ n: count() }).from(notification)
    .where(and(eq(notification.userId, u.id), isNull(notification.readAt)));

  const links = [
    { href: "/", label: t("map") },
    { href: "/route", label: t("route") },
    { href: "/favorites", label: t("favorites") },
    { href: "/alerts", label: t("alerts") },
    { href: "/vehicles", label: t("vehicles") },
    { href: "/settings", label: t("settings") },
    ...(u.role !== "user" ? [{ href: "/moderation", label: t("moderation") }] : []),
    ...(u.role === "admin" ? [{ href: "/admin", label: t("admin") }] : []),
  ];

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Jauge">
          <Logo size={28} />
          <span className="hidden font-semibold sm:inline">Jauge</span>
        </Link>
        <NavLinks links={links} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link href="/notifications" className="relative rounded-md p-2 hover:bg-surface-2" aria-label={t("notifications")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {n > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">{n}</span>}
          </Link>
          <SignOutButton label={t("signOut")} />
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <FxProvider target={u.preferences.displayCurrency || null} rates={(await getSetting("ecb_rates"))?.rates ?? {}}>{children}</FxProvider>
      </div>
    </div>
  );
}
