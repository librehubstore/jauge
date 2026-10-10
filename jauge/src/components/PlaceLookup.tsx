"use client";

import { useLocale } from "next-intl";
import { useState } from "react";

export type Place = { label: string; lat: number; lon: number };

/** Recherche d'adresse (géocodage) avec choix explicite du résultat. */
export function PlaceLookup({ placeholder, selected, onPick }: { placeholder: string; selected: Place | null; onPick: (p: Place) => void }) {
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);

  async function search() {
    if (q.trim().length < 2) return;
    const r = await fetch(`/api/geocode?${new URLSearchParams({ q, lang: locale })}`);
    setPlaces(r.ok ? await r.json() : []);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
        <button type="button" className="btn-ghost" onClick={search}>OK</button>
      </div>
      {places.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {places.map((p, i) => (
            <li key={i}>
              <button type="button" aria-pressed={selected === p} onClick={() => onPick(p)}
                className={`w-full px-3 py-2 text-left hover:bg-surface-2 ${selected === p ? "bg-surface-2 font-medium" : ""}`}>{p.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
