"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

export type Place = { label: string; lat: number; lon: number };

/**
 * Champ d'adresse avec suggestions pendant la frappe (géocodage). Le choix referme la liste et
 * s'affiche dans le champ ; modifier le texte rouvre les suggestions.
 */
export function PlaceLookup({ placeholder, selected, onPick, label }: {
  placeholder: string; selected: Place | null; onPick: (p: Place | null) => void; label?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const id = useId();
  const [q, setQ] = useState(selected?.label ?? "");
  const [items, setItems] = useState<Place[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const picked = !!selected && q === selected.label;

  // Sélection venue de l'extérieur (lien partagé) : on l'affiche.
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) { setLastSelected(selected); if (selected) setQ(selected.label); }

  useEffect(() => {
    if (picked || q.trim().length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geocode?${new URLSearchParams({ q, lang: locale })}`, { signal: ctrl.signal });
        setItems(r.ok ? await r.json() : []);
        setActive(-1);
      } catch { /* requête annulée */ } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, picked, locale]);

  const shown = picked || q.trim().length < 3 ? [] : items;

  function choose(p: Place) {
    setQ(p.label);
    setItems([]);
    onPick(p);
  }

  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <div className="relative">
        <input id={id} className={`input pr-10 ${picked ? "border-accent font-medium" : ""}`} type="search" enterKeyHint="search"
          autoComplete="off" placeholder={placeholder} value={q}
          role="combobox" aria-expanded={shown.length > 0} aria-controls={`${id}-list`} aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); if (selected) onPick(null); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === "Enter") { e.preventDefault(); if (shown.length) choose(shown[Math.max(0, active)]); }
          }} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted" aria-hidden="true">
          {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
            : picked ? <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 5 5L20 7" /></svg>
            : null}
        </span>
      </div>
      {shown.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          {shown.map((p, i) => (
            <li key={`${p.lat},${p.lon},${i}`} role="option" aria-selected={i === active}>
              <button type="button" onClick={() => choose(p)}
                className={`flex min-h-11 w-full items-center px-3 text-left text-base active:bg-surface-2 md:min-h-9 md:text-sm md:hover:bg-surface-2 ${i === active ? "bg-surface-2" : ""}`}>
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!picked && !loading && q.trim().length >= 3 && items.length === 0 && (
        <p className="mt-1 text-sm text-muted">{t("noMatch")}</p>
      )}
    </div>
  );
}
