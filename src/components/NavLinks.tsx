"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-surface-2 font-medium" : "text-muted hover:text-fg"}`}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
