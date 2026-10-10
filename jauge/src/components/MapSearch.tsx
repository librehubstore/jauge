"use client";

import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FUEL_CODES, SERVICES, fuelUnit } from "@/lib/fuels";
import type { SortKey, StationResult } from "@/lib/search";
import { useFmt } from "./format";
import type { MapPoint } from "./StationMap";

const StationMap = dynamic(() => import("./StationMap").then((m) => m.StationMap), { ssr: false });

type Vehicle = { id: number; name: string; fuelCode: string; isDefault: boolean };
type Prefs = { defaultFuel: string; radiusKm: number; distanceUnit: "km" | "mi" };
type Zone = { lat: number; lon: number; zoom?: number; seq: number };

const FALLBACK: Zone = { lat: 48.8566, lon: 2.3522, zoom: 12, seq: 0 };
const ZONE_KEY = "jauge.lastZone";
const FILTER_KEYS = ["onlySelling", "hideOutages", "openNow", "automat24", "includeOld", "favoritesFirst"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const store = {
  get(): Zone | null { try { return JSON.parse(localStorage.getItem(ZONE_KEY) ?? "null"); } catch { return null; } },
  set(z: { lat: number; lon: number }) { try { localStorage.setItem(ZONE_KEY, JSON.stringify(z)); } catch { /* stockage indisponible */ } },
};

export function MapSearch({ vehicles, prefs }: { vehicles: Vehicle[]; prefs: Prefs }) {
  const t = useTranslations("search");
  const tf = useTranslations("fuel");
  const ts = useTranslations("service");
  const tp = useTranslations("price");
  const tst = useTranslations("station");
  const tc = useTranslations("common");
  const tv = useTranslations("vehicles");
  const tcontrib = useTranslations("contrib");
  const locale = useLocale();
  const fmt = useFmt(prefs.distanceUnit);
  const router = useRouter();

  const defaultVehicle = vehicles.find((v) => v.isDefault) ?? vehicles[0];
  const [vehicleId, setVehicleId] = useState<number | null>(defaultVehicle?.id ?? null);
  const [fuel, setFuel] = useState(defaultVehicle?.fuelCode ?? prefs.defaultFuel);
  const [radius, setRadius] = useState(prefs.radiusKm);
  const [sort, setSort] = useState<SortKey>("best");
  const [level, setLevel] = useState(0.25);
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    onlySelling: true, hideOutages: false, openNow: false, automat24: false, includeOld: false, favoritesFirst: false,
  });
  const [services, setServices] = useState<string[]>([]);
  const [excludeBrands, setExcludeBrands] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Dernière zone (ou repli) affichée tout de suite ; la géolocalisation recentre ensuite si elle aboutit.
  const [zone, setZone] = useState<Zone | null>(null);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState(false);
  const [pendingArea, setPendingArea] = useState<{ lat: number; lon: number; radiusKm: number } | null>(null);

  const [data, setData] = useState<{ stations: StationResult[]; median: number | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Niveau du réservoir mémorisé pour la session (spec 4.5).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage navigateur après hydratation
  useEffect(() => { try { const l = sessionStorage.getItem("jauge.level"); if (l) setLevel(Number(l)); } catch { /* */ } }, []);
  useEffect(() => { try { sessionStorage.setItem("jauge.level", String(level)); } catch { /* */ } }, [level]);

  const locate = useCallback((fallback: boolean) => {
    if (!("geolocation" in navigator)) { if (fallback) setZone(store.get() ?? FALLBACK); setGeoMsg(true); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
        setMe(pos); setGeoMsg(false);
        setZone((z) => ({ ...pos, zoom: 13, seq: (z?.seq ?? 0) + 1 }));
      },
      () => { setGeoMsg(true); if (fallback) setZone({ ...(store.get() ?? FALLBACK), seq: 1 }); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- géolocalisation (système externe) au montage
  useEffect(() => { setZone({ ...(store.get() ?? FALLBACK), seq: 0 }); locate(false); }, [locate]);

  // Recherche (avec annulation de la requête précédente).
  useEffect(() => {
    if (!zone) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      lat: zone.lat.toFixed(5), lon: zone.lon.toFixed(5), radius: String(radius), fuel, sort, level: String(level),
      ...(vehicleId ? { vehicleId: String(vehicleId) } : {}),
      ...Object.fromEntries(FILTER_KEYS.map((k) => [k, filters[k] ? "1" : "0"])),
      ...(services.length ? { services: services.join(",") } : {}),
      ...(excludeBrands.length ? { excludeBrands: excludeBrands.join(",") } : {}),
    });
    const timer = setTimeout(async () => {
      setLoading(true); setError(false);
      try {
        const res = await fetch(`/api/stations?${qs}`, { signal: ctrl.signal });
        if (res.status === 401) { router.replace("/login"); return; }
        if (!res.ok) throw new Error(String(res.status));
        setData(await res.json());
        store.set({ lat: zone.lat, lon: zone.lon });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [zone, radius, fuel, sort, level, vehicleId, filters, services, excludeBrands, router]);

  const stations = useMemo(() => data?.stations ?? [], [data]);
  const unit = fuelUnit(fuel);
  const points: MapPoint[] = useMemo(() => stations.map((s) => ({
    id: s.id, lat: s.lat, lon: s.lon, tier: s.outage ? null : s.tier,
    label: s.price !== null ? s.price.toFixed(3) : "",
  })), [stations]);

  const brandsInResults = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of stations) if (s.brandId && s.brand) m.set(s.brandId, s.brand);
    for (const id of excludeBrands) if (!m.has(id)) m.set(id, `#${id}`);
    return [...m].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [stations, excludeBrands, locale]);

  const select = useCallback((id: number) => {
    setHighlight(id);
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function pickVehicle(id: string) {
    const v = vehicles.find((x) => x.id === Number(id));
    setVehicleId(v?.id ?? null);
    if (v) setFuel(v.fuelCode);
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Panneau : recherche, réglages, liste */}
      <section className="order-2 flex min-h-0 flex-1 flex-col border-border md:order-1 md:w-[420px] md:flex-none md:border-r" aria-label={t("list")}>
        <div className="space-y-2.5 border-b border-border bg-surface p-3">
          <PlaceSearch
            placeholder={t("placeholder")} locale={locale}
            onPick={(p) => { setPendingArea(null); setZone((z) => ({ lat: p.lat, lon: p.lon, zoom: 13, seq: (z?.seq ?? 0) + 1 })); }}
            aroundMe={t("aroundMe")} onAroundMe={() => locate(false)}
          />
          {geoMsg && <p className="text-xs text-muted" role="status">{t("geoDenied")}</p>}

          <div className="grid grid-cols-2 gap-2">
            {vehicles.length > 0 && (
              <select className="input" aria-label={tv("title")} value={vehicleId ?? ""} onChange={(e) => pickVehicle(e.target.value)}>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
            <select className="input" aria-label={t("fuel")} value={fuel} onChange={(e) => setFuel(e.target.value)}
              title={tf(fuel as never)}>
              {FUEL_CODES.map((c) => <option key={c} value={c}>{tf(c)}</option>)}
            </select>
            <select className="input" aria-label={t("sort")} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {(["best", "price", "fill", "distance"] as const).map((k) => <option key={k} value={k}>{t(`sortBy.${k}`)}</option>)}
            </select>
            <select className="input" aria-label={t("radius")} value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[2, 5, 10, 20, 30, 50].map((r) => <option key={r} value={r}>{fmt.distance(r)}</option>)}
            </select>
          </div>

          <label className="block text-xs text-muted">
            {t("level", { value: Math.round(level * 100) })}
            <input type="range" min={0} max={0.9} step={0.05} value={level} onChange={(e) => setLevel(Number(e.target.value))}
              className="mt-1 block w-full accent-[var(--accent)]" />
          </label>

          <button type="button" className="text-sm font-medium text-accent" aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
            {t("filters")} {showFilters ? "▴" : "▾"}
          </button>
          {showFilters && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {FILTER_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" checked={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.checked }))} />
                    {t(k)}
                  </label>
                ))}
              </div>
              <fieldset>
                <legend className="mb-1 font-medium">{t("services")}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {SERVICES.map((s) => (
                    <Chip key={s} on={services.includes(s)} onClick={() => setServices((v) => v.includes(s) ? v.filter((x) => x !== s) : [...v, s])}>
                      {ts(s)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              {brandsInResults.length > 0 && (
                <fieldset>
                  <legend className="mb-1 font-medium">{t("excludeBrands")}</legend>
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {brandsInResults.map(([id, name]) => (
                      <Chip key={id} on={excludeBrands.includes(id)} strike
                        onClick={() => setExcludeBrands((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])}>
                        {name}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted" aria-live="polite">
          <span>{loading ? tc("loading") : t("results", { count: stations.length })}</span>
          {data?.median != null && <span>{t("median", { value: fmt.price(data.median) })}</span>}
          <Link href="/report-station" className="text-accent hover:underline">{tcontrib("missingLink")}</Link>
        </div>
        {stations.some((s) => s.country === "AT") && (
          <p className="mx-3 mb-2 rounded-md bg-tier-1/10 px-3 py-2 text-xs">{t("partialAT")}</p>
        )}
        {error && <p role="alert" className="mx-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{tc("error")}</p>}
        {!loading && !error && data && stations.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{t("noResults")}</p>}

        <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {stations.map((s) => (
            <li key={s.id} data-id={s.id}
              onMouseEnter={() => setHighlight(s.id)} onFocus={() => setHighlight(s.id)}
              className={`border-b border-border ${highlight === s.id ? "bg-surface-2" : ""}`}>
              <Link href={`/station/${s.id}`} className="flex gap-3 px-3 py-3 focus-visible:outline-2 focus-visible:outline-accent">
                <TierDot tier={s.outage ? null : s.tier} label={s.outage ? tst("outageTemporary") : t(`tier.${s.tier ?? "none"}` as never)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{s.brand ?? s.name ?? s.city ?? "—"}{s.favorite && <span className="ml-1 text-danger" aria-label="★">♥</span>}</p>
                    {s.price !== null
                      ? <p className="price shrink-0 text-base font-semibold">{fmt.price(s.price, s.currency ?? "EUR")}<span className="text-xs font-normal text-muted">/{unit}</span></p>
                      : <p className="shrink-0 text-xs text-muted">{tp("noPrice")}</p>}
                  </div>
                  <p className="truncate text-xs text-muted">{[s.address, s.city].filter(Boolean).join(", ")}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    <span>{fmt.distance(s.distanceKm)}</span>
                    {s.priceUpdatedAt && (
                      <span className={s.freshness === "fresh" ? "text-muted" : "text-tier-1"}>
                        {fmt.ago(s.priceUpdatedAt)}{s.freshness !== "fresh" && ` · ${tp("old")}`}{s.origin === "community" && ` · ${tp("community")}`}
                      </span>
                    )}
                    {s.outage && <span className="font-medium text-danger">{tst("outageTemporary")}</span>}
                    {s.openNow === false && <span className="text-danger">{tst("closedNow")}</span>}
                  </div>
                  {s.fillCost !== null && (
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>{t("fillCost", { value: fmt.money(s.fillCost, s.currency ?? "EUR") })}</span>
                      <span>{t("detour", { km: fmt.distance(s.detourKm), cost: fmt.money(s.detourCost ?? 0, s.currency ?? "EUR") })}{s.detourMinutes !== null ? ` · ${s.detourMinutes} min` : ` (${t("estimated")})`}</span>
                      {s.saving !== null && s.saving > 0.005 && <span className="font-medium text-tier-0">{t("saving", { value: fmt.money(s.saving, s.currency ?? "EUR") })}</span>}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Carte */}
      <section className="relative order-1 h-[42dvh] shrink-0 md:order-2 md:h-auto md:flex-1" aria-label={t("map")}>
        {zone && (
          <StationMap
            center={zone} me={me} points={points} highlightId={highlight}
            onSelect={select}
            onUserMove={(c) => setPendingArea(c)}
            recenterLabel={t("recenter")}
            onRecenter={() => (me ? setZone((z) => ({ ...me, zoom: 13, seq: (z?.seq ?? 0) + 1 })) : locate(false))}
          />
        )}
        {pendingArea && (
          <button type="button" className="btn-primary absolute left-1/2 top-3 -translate-x-1/2 shadow-md"
            onClick={() => { setRadius(Math.min(50, Math.max(2, pendingArea.radiusKm))); setZone((z) => ({ lat: pendingArea.lat, lon: pendingArea.lon, seq: z?.seq ?? 0, zoom: undefined })); setPendingArea(null); }}>
            {t("searchArea")}
          </button>
        )}
      </section>
    </div>
  );
}

function TierDot({ tier, label }: { tier: 0 | 1 | 2 | null; label: string }) {
  const color = tier === null ? "bg-tier-none" : ["bg-tier-0", "bg-tier-1", "bg-tier-2"][tier];
  // Couleur doublée d'un libellé textuel (accessibilité, spec 10).
  return (
    <span className="flex w-10 shrink-0 flex-col items-center pt-1">
      <span className={`h-3 w-3 rounded-full ${color}`} aria-hidden="true" />
      <span className="mt-1 text-center text-[10px] leading-tight text-muted">{label}</span>
    </span>
  );
}

function Chip({ on, strike, onClick, children }: { on: boolean; strike?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-accent bg-accent text-accent-fg" : "border-border hover:bg-surface-2"} ${on && strike ? "line-through" : ""}`}>
      {children}
    </button>
  );
}

function PlaceSearch({ placeholder, locale, onPick, aroundMe, onAroundMe }: {
  placeholder: string; locale: string; onPick: (p: { lat: number; lon: number }) => void; aroundMe: string; onAroundMe: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/geocode?${new URLSearchParams({ q, lang: locale })}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : [])).then((d) => { setItems(d); setOpen(true); setActive(-1); }).catch(() => {});
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [q, locale]);

  const shown = q.trim().length < 3 ? [] : items;

  function choose(i: number) {
    const it = shown[i];
    if (!it) return;
    setQ(it.label); setOpen(false); onPick(it);
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input className="input" type="search" placeholder={placeholder} aria-label={placeholder} value={q}
          role="combobox" aria-expanded={open && shown.length > 0} aria-controls="place-list" aria-autocomplete="list"
          onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === "Enter") { e.preventDefault(); choose(active >= 0 ? active : 0); }
            if (e.key === "Escape") setOpen(false);
          }} />
        {open && shown.length > 0 && (
          <ul id="place-list" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            {shown.map((it, i) => (
              <li key={i} role="option" aria-selected={i === active}
                className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-surface-2" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
                {it.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="btn-ghost shrink-0" onClick={onAroundMe} title={aroundMe}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
        <span className="hidden sm:inline">{aroundMe}</span>
      </button>
    </div>
  );
}
