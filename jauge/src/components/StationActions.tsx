"use client";

import { useState, useTransition } from "react";
import { reportOutage, setFavorite } from "@/app/actions/app";

export function FavoriteButton({ stationId, initial, labels }: { stationId: number; initial: boolean; labels: { on: string; off: string } }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={on} disabled={pending} title={on ? labels.on : labels.off} aria-label={on ? labels.on : labels.off}
      className="btn-ghost shrink-0"
      onClick={() => start(async () => { setOn(!on); await setFavorite(stationId, !on); })}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? "var(--danger)" : "none"} stroke={on ? "var(--danger)" : "currentColor"} strokeWidth="1.8" aria-hidden="true">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}

export function ReportOutage({ stationId, fuels, labels }: {
  stationId: number; fuels: { code: string; label: string }[]; labels: { title: string; done: string; send: string };
}) {
  const [fuel, setFuel] = useState(fuels[0]?.code ?? "");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (!fuels.length) return null;
  if (done) return <p role="status" className="rounded-md bg-accent/10 px-3 py-2 text-sm">{labels.done}</p>;
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await reportOutage(stationId, fuel); setDone(true); }); }}>
      <label className="flex-1 text-sm">
        <span className="label">{labels.title}</span>
        <select className="input" value={fuel} onChange={(e) => setFuel(e.target.value)}>
          {fuels.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
        </select>
      </label>
      <button className="btn-ghost" disabled={pending}>{labels.send}</button>
    </form>
  );
}
