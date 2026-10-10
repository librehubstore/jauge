"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteVehicle, saveVehicle, setDefaultVehicle } from "@/app/actions/app";
import { FUEL_CODES, fuelUnit } from "@/lib/fuels";

type V = { id: number; name: string; fuelCode: string; secondaryFuelCode: string | null; tankCapacity: number; consumptionPer100km: number; isDefault: boolean };

export function VehicleManager({ vehicles }: { vehicles: V[] }) {
  const t = useTranslations("vehicles");
  const tf = useTranslations("fuel");
  const tc = useTranslations("common");
  const [editing, setEditing] = useState<Partial<V> | null>(vehicles.length ? null : {});
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      {vehicles.length === 0 && !editing && <p className="text-sm text-muted">{t("empty")}</p>}
      <ul className="space-y-2">
        {vehicles.map((v) => (
          <li key={v.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{v.name} {v.isDefault && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-fg">{t("default")}</span>}</p>
              <p className="text-xs text-muted">
                {tf(v.fuelCode as never)}{v.secondaryFuelCode && ` + ${tf(v.secondaryFuelCode as never)}`} · {v.tankCapacity} {fuelUnit(v.fuelCode)} · {v.consumptionPer100km} {fuelUnit(v.fuelCode)}/100 km
              </p>
            </div>
            {!v.isDefault && <button className="btn-ghost" disabled={pending} onClick={() => start(() => setDefaultVehicle(v.id))}>{t("makeDefault")}</button>}
            <button className="btn-ghost" onClick={() => setEditing(v)}>✎</button>
            <button className="btn-danger" disabled={pending} onClick={() => start(() => deleteVehicle(v.id))}>{tc("delete")}</button>
          </li>
        ))}
      </ul>

      {editing ? (
        <VehicleForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} canCancel={vehicles.length > 0} />
      ) : (
        <button className="btn-primary" onClick={() => setEditing({})}>{t("add")}</button>
      )}
    </div>
  );
}

function VehicleForm({ initial, onDone, canCancel }: { initial: Partial<V>; onDone: () => void; canCancel: boolean }) {
  const t = useTranslations("vehicles");
  const tf = useTranslations("fuel");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [fuel, setFuel] = useState(initial.fuelCode ?? "B7");
  const [err, setErr] = useState(false);
  const unit = fuelUnit(fuel);
  return (
    <form className="card grid gap-3 p-4 sm:grid-cols-2" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        try {
          await saveVehicle({
            id: initial.id, name: String(f.get("name")), fuelCode: fuel,
            secondaryFuelCode: String(f.get("secondary") ?? ""), tankCapacity: Number(f.get("tank")),
            consumptionPer100km: Number(f.get("consumption")), isDefault: initial.isDefault,
          });
          onDone();
        } catch { setErr(true); }
      });
    }}>
      <label className="sm:col-span-2"><span className="label">{t("name")}</span>
        <input className="input" name="name" required maxLength={60} defaultValue={initial.name} /></label>
      <label><span className="label">{t("fuel")}</span>
        <select className="input" value={fuel} onChange={(e) => setFuel(e.target.value)}>
          {FUEL_CODES.filter((c) => c !== "ADBLUE").map((c) => <option key={c} value={c}>{tf(c)}</option>)}
        </select></label>
      <label><span className="label">{t("secondaryFuel")}</span>
        <select className="input" name="secondary" defaultValue={initial.secondaryFuelCode ?? ""}>
          <option value="">{tc("none")}</option>
          {(["LPG", "CNG", "E85"] as const).map((c) => <option key={c} value={c}>{tf(c)}</option>)}
        </select></label>
      <label><span className="label">{t("tank", { unit })}</span>
        <input className="input" name="tank" type="number" min={1} max={2000} step="any" required defaultValue={initial.tankCapacity ?? 50} /></label>
      <label><span className="label">{t("consumption", { unit })}</span>
        <input className="input" name="consumption" type="number" min={0.1} max={100} step="any" required defaultValue={initial.consumptionPer100km ?? 6} /></label>
      {err && <p role="alert" className="text-sm text-danger sm:col-span-2">{tc("error")}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{tc("save")}</button>
        {canCancel && <button type="button" className="btn-ghost" onClick={onDone}>{tc("cancel")}</button>}
      </div>
    </form>
  );
}
