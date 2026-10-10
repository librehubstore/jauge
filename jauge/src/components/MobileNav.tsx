"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

const ICONS = {
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4",
  heart: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  more: "M4 6h16M4 12h16M4 18h16",
  car: "M5 17h14M6 17v2m12-2v2M5 17l1.5-6h11l1.5 6M7.5 11 9 7h6l1.5 4M7 14h.01M17 14h.01",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  tool: "M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01",
  out: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
} as const;

export function Icon({ name, className = "h-6 w-6" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

const Badge = ({ n }: { n: number }) => (
  <span className="absolute right-[calc(50%-20px)] top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">{n}</span>
);

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Barre d'onglets en bas d'écran (mobile) : 4 destinations + « Plus » qui ouvre le reste dans un panneau. */
export function MobileNav({ tabs, more, moreLabel, signOutLabel, unread }: {
  tabs: NavItem[]; more: NavItem[]; moreLabel: string; signOutLabel: string; unread: number;
}) {
  const path = usePathname();
  const router = useRouter();
  const sheet = useRef<HTMLDialogElement>(null);
  const moreActive = more.some((m) => isActive(path, m.href));

  // Ferme le panneau à chaque changement de page.
  useEffect(() => { sheet.current?.close(); }, [path]);

  return (
    <>
      <nav className="z-40 grid shrink-0 grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs.map((t) => {
          const active = isActive(path, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}>
              <Icon name={t.icon} />
              {t.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => sheet.current?.showModal()} aria-haspopup="dialog"
          className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${moreActive ? "text-accent" : "text-muted"}`}>
          <Icon name="more" />
          {unread > 0 && <Badge n={unread} />}
          {moreLabel}
        </button>
      </nav>

      <dialog ref={sheet} aria-label={moreLabel}
        onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}
        className="mb-0 mt-auto w-full max-w-none rounded-t-2xl bg-surface p-0 text-fg backdrop:bg-black/50 md:hidden">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        <ul className="px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          {more.map((m) => (
            <li key={m.href}>
              <Link href={m.href} className={`flex min-h-12 items-center gap-3 rounded-lg px-3 text-base ${isActive(path, m.href) ? "bg-surface-2 font-medium" : ""}`}>
                <Icon name={m.icon} className="h-5 w-5 text-muted" />{m.label}
                {m.href === "/notifications" && unread > 0 && <span className="ml-auto rounded-full bg-danger px-2 text-xs font-semibold leading-5 text-white">{unread}</span>}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-border pt-1">
            <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base text-danger"
              onClick={async () => { await authClient.signOut(); router.replace("/login"); router.refresh(); }}>
              <Icon name="out" className="h-5 w-5" />{signOutLabel}
            </button>
          </li>
        </ul>
      </dialog>
    </>
  );
}
