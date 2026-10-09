"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { setFavorite } from "@/app/actions/app";
import { useFmt } from "./format";

type Item = { id: number; label: string; address: string; price: number | null; currency: string; updatedAt: string | null; change: number | null };

export function FavoritesList({ items, fuel }: { items: Item[]; fuel: string }) {
  const t = useTranslations("favorites");
  const tc = useTranslations("common");
  const tf = useTranslations("fuel");
  const ts = useTranslations("station");
  const fmt = useFmt();
  const [hidden, setHidden] = useState<number[]>([]);
  const [undo, setUndo] = useState<Item | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Retrait immédiat côté serveur ; « Annuler » le rétablit pendant 5 s (spec 4.6).
  async function remove(it: Item) {
    setHidden((h) => [...h, it.id]);
    setUndo(it);
    await setFavorite(it.id, false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setUndo(null), 5000);
  }
  async function restore() {
    if (!undo) return;
    const it = undo;
    setUndo(null);
    setHidden((h) => h.filter((x) => x !== it.id));
    await setFavorite(it.id, true);
  }

  const visible = items.filter((i) => !hidden.includes(i.id));
  return (
    <>
      <p className="mb-3 text-sm text-muted">{tf(fuel as never)}</p>
      {visible.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}
      <ul className="card divide-y divide-border">
        {visible.map((it) => (
          <li key={it.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/station/${it.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{it.label}</p>
              <p className="truncate text-xs text-muted">{it.address}</p>
              {it.updatedAt && <p className="text-xs text-muted">{fmt.ago(it.updatedAt)}</p>}
            </Link>
            <div className="text-right">
              {it.price !== null ? <p className="price font-semibold">{fmt.price(it.price, it.currency)}</p> : <p className="text-xs text-muted">—</p>}
              {it.change !== null && Math.abs(it.change) >= 0.001 && (
                <p className={`price text-xs ${it.change < 0 ? "text-tier-0" : "text-tier-2"}`}>
                  {t("change", { value: `${it.change > 0 ? "+" : ""}${fmt.price(it.change, it.currency)}` })}
                </p>
              )}
            </div>
            <button type="button" className="rounded-md p-2 hover:bg-surface-2" aria-label={ts("unfavorite")} title={ts("unfavorite")} onClick={() => remove(it)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--danger)" stroke="var(--danger)" strokeWidth="1.8" aria-hidden="true">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {undo && (
        <div role="status" className="fixed inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-4 rounded-md bg-fg px-4 py-2.5 text-sm text-bg shadow-lg">
          {t("removed")}
          <button type="button" className="font-semibold underline" onClick={restore}>{tc("undo")}</button>
        </div>
      )}
    </>
  );
}
