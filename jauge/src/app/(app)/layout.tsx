import { and, count, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { db } from "@/db";
import { notification } from "@/db/schema";
import { FxProvider } from "@/components/FxContext";
import { Logo } from "@/components/Logo";
import { MobileNav, type NavItem } from "@/components/MobileNav";
import { NavLinks } from "@/components/NavLinks";
import { OfflineBanner } from "@/components/Pwa";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/session";
import { getSetting } from "@/lib/settings";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const u = await requireUser();
  const t = await getTranslations("nav");
  const [{ n }] = await db.select({ n: count() }).from(notification)
    .where(and(eq(notification.userId, u.id), isNull(notification.readAt)));

  // Mobile : 4 onglets pour les usages au volant, le reste dans « Plus ».
  const tabs: NavItem[] = [
    { href: "/", label: t("map"), icon: "map" },
    { href: "/route", label: t("route"), icon: "route" },
    { href: "/favorites", label: t("favorites"), icon: "heart" },
    { href: "/alerts", label: t("alerts"), icon: "bell" },
  ];
  const more: NavItem[] = [
    { href: "/notifications", label: t("notifications"), icon: "bell" },
    { href: "/vehicles", label: t("vehicles"), icon: "car" },
    { href: "/settings", label: t("settings"), icon: "gear" },
    ...(u.role !== "user" ? [{ href: "/moderation", label: t("moderation"), icon: "shield" } as NavItem] : []),
    ...(u.role === "admin" ? [{ href: "/admin", label: t("admin"), icon: "tool" } as NavItem] : []),
    { href: "/about", label: t("about"), icon: "info" },
  ];
  const desktopLinks = [...tabs, ...more.filter((m) => !["/notifications", "/about"].includes(m.href))];

  return (
    <div className="flex h-dvh flex-col">
      {/* Bureau : barre de navigation en haut. Mobile : barre d'onglets en bas (MobileNav). */}
      <header className="hidden shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-2 md:flex">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Jauge">
          <Logo size={28} />
          <span className="font-semibold">Jauge</span>
        </Link>
        <NavLinks links={desktopLinks} />
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
      <OfflineBanner />
      <main className="min-h-0 flex-1 pt-[env(safe-area-inset-top)] md:pt-0">
        <FxProvider target={u.preferences.displayCurrency || null} rates={(await getSetting("ecb_rates"))?.rates ?? {}}>{children}</FxProvider>
      </main>
      <MobileNav tabs={tabs} more={more} moreLabel={t("more")} signOutLabel={t("signOut")} unread={n} />
    </div>
  );
}
