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
  const tpwa = useTranslations("pwa");
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
  const [offlineAt, setOfflineAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<"peek" | "half" | "full">("peek");
  const [dragH, setDragH] = useState<number | null>(null);

  /** Glisser la poignée : la hauteur suit le doigt, puis se cale sur la position la plus proche. */
  function startDrag(e: React.PointerEvent) {
    const sheet = sheetRef.current, parent = sheet?.parentElement;
    if (!sheet || !parent) return;
    const startY = e.clientY, startH = sheet.getBoundingClientRect().height, total = parent.getBoundingClientRect().height;
    let moved = false, h = startH;
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startY) > 6) moved = true;
      if (!moved) return;
      h = Math.min(total - 76, Math.max(120, startH + startY - ev.clientY));
      setDragH(h);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) return;
      const r = h / total;
      setSnap(r < 0.46 ? "peek" : r < 0.78 ? "half" : "full");
      setDragH(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

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

  /* eslint-disable react-hooks/set-state-in-effect -- initialisation unique au montage (URL, stockage, géolocalisation) */
  useEffect(() => {
    // Lien partagé : la vue de l'URL prime sur la géolocalisation.
    const q = new URLSearchParams(location.search);
    const lat = Number(q.get("lat")), lon = Number(q.get("lon"));
    if (q.get("lat") && Number.isFinite(lat) && Number.isFinite(lon)) {
      if (q.get("fuel")) setFuel(q.get("fuel")!);
      if (q.get("r")) setRadius(Number(q.get("r")));
      if (q.get("sort")) setSort(q.get("sort") as SortKey);
      setFilters((f) => Object.fromEntries(FILTER_KEYS.map((k) => [k, q.has(k) ? q.get(k) === "1" : f[k]])) as Record<FilterKey, boolean>);
      setZone({ lat, lon, zoom: 13, seq: 0 });
      return;
    }
    setZone({ ...(store.get() ?? FALLBACK), seq: 0 });
    locate(false);
  }, [locate]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        // Réponse servie par le service worker hors ligne : on affiche la date des données.
        setOfflineAt(res.headers.get("x-jauge-offline") || null);
        store.set({ lat: zone.lat, lon: zone.lon });
        // Lien partageable : l'URL reflète la vue (zone, carburant, rayon, tri, filtres).
        const share = new URLSearchParams({ lat: zone.lat.toFixed(4), lon: zone.lon.toFixed(4), fuel, r: String(radius), sort });
        FILTER_KEYS.forEach((k) => { if (filters[k] !== (k === "onlySelling")) share.set(k, filters[k] ? "1" : "0"); });
        history.replaceState(null, "", `/?${share}`);
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
    setSnap((v) => (v === "peek" ? "half" : v));
    listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function pickVehicle(id: string) {
    const v = vehicles.find((x) => x.id === Number(id));
    setVehicleId(v?.id ?? null);
    if (v) setFuel(v.fuelCode);
  }

  const activeFilters = FILTER_KEYS.filter((k) => filters[k] !== (k === "onlySelling")).length + services.length + excludeBrands.length;

  return (
    <div className="relative h-full overflow-hidden md:grid md:grid-cols-[420px_1fr] md:grid-rows-[auto_1fr]">
      {/* Recherche : flottante sur la carte (mobile), en tête du panneau (bureau) */}
      <div className="absolute inset-x-3 top-3 z-30 md:static md:col-start-1 md:row-start-1 md:border-b md:border-r md:border-border md:bg-surface md:p-3">
        <PlaceSearch
          placeholder={t("placeholder")} locale={locale}
          onPick={(p) => { setPendingArea(null); setZone((z) => ({ lat: p.lat, lon: p.lon, zoom: 13, seq: (z?.seq ?? 0) + 1 })); }}
          aroundMe={t("aroundMe")} onAroundMe={() => locate(false)}
        />
        {geoMsg && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted shadow-sm md:p-0 md:shadow-none" role="status">{t("geoDenied")}</p>}
      </div>

      {/* Carte : plein écran sur mobile */}
      <section className="absolute inset-0 md:relative md:col-start-2 md:row-span-2 md:row-start-1" aria-label={t("map")}>
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
          <button type="button" className="btn-primary absolute left-1/2 top-20 z-10 -translate-x-1/2 shadow-md md:top-3"
            onClick={() => { setRadius(Math.min(50, Math.max(2, pendingArea.radiusKm))); setZone((z) => ({ lat: pendingArea.lat, lon: pendingArea.lon, seq: z?.seq ?? 0, zoom: undefined })); setPendingArea(null); }}>
            {t("searchArea")}
          </button>
        )}
      </section>

      {/* Résultats : panneau coulissant (mobile), colonne (bureau) */}
      <section ref={sheetRef} aria-label={t("list")}
        style={{ "--sheet-h": dragH !== null ? `${dragH}px` : SNAP_HEIGHT[snap] } as React.CSSProperties}
        className={`absolute inset-x-0 bottom-0 z-20 flex h-[var(--sheet-h)] flex-col rounded-t-2xl bg-surface shadow-[0_-6px_24px_rgb(0_0_0/0.14)] md:static md:col-start-1 md:row-start-2 md:h-auto md:min-h-0 md:rounded-none md:border-r md:border-border md:shadow-none ${dragH === null ? "transition-[height] duration-200 ease-out motion-reduce:transition-none" : ""}`}>
        {/* Poignée : toucher pour changer de hauteur, glisser pour ajuster */}
        <button type="button" aria-label={t("list")} aria-expanded={snap !== "peek"}
          className="flex h-6 shrink-0 touch-none items-center justify-center md:hidden"
          onClick={() => setSnap((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"))}
          onPointerDown={startDrag}>
          <span className="h-1.5 w-10 rounded-full bg-border" />
        </button>

        <div className="shrink-0 space-y-2 border-b border-border px-3 pb-2.5 md:pt-3">
          <div className="flex items-baseline justify-between gap-2" aria-live="polite">
            <p className="text-base font-semibold">{loading ? tc("loading") : t("results", { count: stations.length })}</p>
            {data?.median != null && <p className="text-sm text-muted">{t("median", { value: fmt.price(data.median) })}</p>}
          </div>
          {/* Réglages en pastilles, défilables horizontalement */}
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
            {vehicles.length > 1 && (
              <PillSelect label={tv("title")} value={String(vehicleId ?? "")} onChange={pickVehicle}
                options={vehicles.map((v) => [String(v.id), v.name])} />
            )}
            <PillSelect label={t("fuel")} value={fuel} onChange={setFuel}
              options={FUEL_CODES.map((c) => [c, tf(c)])} />
            <PillSelect label={t("sort")} value={sort} onChange={(v) => setSort(v as SortKey)}
              options={(["best", "price", "fill", "distance"] as const).map((k) => [k, t(`sortBy.${k}`)])} />
            <PillSelect label={t("radius")} value={String(radius)} onChange={(v) => setRadius(Number(v))}
              options={[2, 5, 10, 20, 30, 50].map((r) => [String(r), fmt.distance(r)])} />
            <button type="button" className={`pill ${showFilters || activeFilters ? "border-accent text-accent" : ""}`} aria-expanded={showFilters}
              onClick={() => { setShowFilters((v) => !v); setSnap("full"); }}>
              {t("filters")}{activeFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-xs leading-5 text-accent-fg">{activeFilters}</span>}
            </button>
          </div>

        </div>

        {showFilters && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pt-3 text-sm">
              <label className="block">
                <span className="mb-1 flex justify-between font-medium"><span>{t("level", { value: Math.round(level * 100) })}</span></span>
                <input type="range" min={0} max={0.9} step={0.05} value={level} onChange={(e) => setLevel(Number(e.target.value))}
                  className="block h-8 w-full accent-[var(--accent)]" />
              </label>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {FILTER_KEYS.map((k) => (
                  <label key={k} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.checked }))} />
                    {t(k)}
                  </label>
                ))}
              </div>
              <fieldset>
                <legend className="mb-2 font-medium">{t("services")}</legend>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map((s) => (
                    <Chip key={s} on={services.includes(s)} onClick={() => setServices((v) => v.includes(s) ? v.filter((x) => x !== s) : [...v, s])}>
                      {ts(s)}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              {brandsInResults.length > 0 && (
                <fieldset>
                  <legend className="mb-2 font-medium">{t("excludeBrands")}</legend>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {brandsInResults.map(([id, name]) => (
                      <Chip key={id} on={excludeBrands.includes(id)} strike
                        onClick={() => setExcludeBrands((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])}>
                        {name}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="sticky bottom-0 -mx-3 border-t border-border bg-surface px-3 py-3">
                <button type="button" className="btn-primary w-full" onClick={() => { setShowFilters(false); setSnap("half"); }}>{t("showResults")}</button>
              </div>
            </div>
          )}

        <ul ref={listRef} hidden={showFilters} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
          {offlineAt && <li role="status" className="mx-3 mt-2 rounded-lg bg-tier-1/15 px-3 py-2 text-sm">{tpwa("offlineData", { date: new Date(offlineAt) })}</li>}
          {fmt.converted(stations[0]?.currency ?? "EUR") && <li className="mx-3 mt-2 text-sm text-muted">≈ {fmt.convertedLabel}</li>}
          {stations.some((s) => s.country === "AT") && <li className="mx-3 mt-2 rounded-lg bg-tier-1/15 px-3 py-2 text-sm">{t("partialAT")}</li>}
          {error && <li role="alert" className="mx-3 mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{tc("error")}</li>}
          {!loading && !error && data && stations.length === 0 && <li className="px-3 py-8 text-center text-base text-muted">{t("noResults")}</li>}
          {stations.map((s) => (
            <li key={s.id} data-id={s.id}
              onMouseEnter={() => setHighlight(s.id)} onFocus={() => setHighlight(s.id)}
              className={`border-b border-border ${highlight === s.id ? "bg-surface-2" : ""}`}>
              <Link href={`/station/${s.id}`} className="block px-3 py-3 active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {s.brand ?? s.name ?? s.city ?? "—"}
                      {s.favorite && <span className="ml-1 text-danger" aria-hidden="true">♥</span>}
                    </p>
                    <p className="truncate text-sm text-muted">{[s.address, s.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {s.price !== null
                      ? <p className="price text-xl font-semibold leading-tight">{fmt.price(s.price, s.currency ?? "EUR")}<span className="text-xs font-normal text-muted">/{unit}</span></p>
                      : <p className="text-sm text-muted">{tp("noPrice")}</p>}
                    <TierBadge tier={s.outage ? null : s.tier} label={s.outage ? tst("outageTemporary") : t(`tier.${s.tier ?? "none"}` as never)} />
                  </div>
                </div>
                <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-muted">
                  <span className="font-medium text-fg">{fmt.distance(s.distanceKm)}</span>
                  {s.openNow === false && <span className="font-medium text-danger">· {tst("closedNow")}</span>}
                  {s.priceUpdatedAt && (
                    <span className={s.freshness === "fresh" ? "" : "font-medium text-tier-1"}>
                      · {fmt.ago(s.priceUpdatedAt)}{s.freshness !== "fresh" && `, ${tp("old")}`}{s.origin === "community" && `, ${tp("community")}`}
                    </span>
                  )}
                </p>
                {s.fillCost !== null && (
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                    <span>{t("fillCost", { value: fmt.money(s.fillCost, s.currency ?? "EUR") })}</span>
                    <span className="text-muted">{t("detour", { km: fmt.distance(s.detourKm), cost: fmt.money(s.detourCost ?? 0, s.currency ?? "EUR") })}{s.detourMinutes !== null ? `, ${s.detourMinutes} min` : ` (${t("estimated")})`}</span>
                    {s.saving !== null && s.saving > 0.005 && <span className="font-semibold text-tier-0">{t("saving", { value: fmt.money(s.saving, s.currency ?? "EUR") })}</span>}
                  </p>
                )}
              </Link>
            </li>
          ))}
          <li className="px-3 py-4 text-center">
            <Link href="/report-station" className="text-sm font-medium text-accent">{tcontrib("missingLink")}</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

const SNAP_HEIGHT: Record<"peek" | "half" | "full", string> = { peek: "34%", half: "58%", full: "calc(100% - 4.75rem)" };

function TierBadge({ tier, label }: { tier: 0 | 1 | 2 | null; label: string }) {
  const tone = tier === null ? "bg-tier-none/15 text-muted" : ["bg-tier-0/15 text-tier-0", "bg-tier-1/15 text-tier-1", "bg-tier-2/15 text-tier-2"][tier];
  // Couleur doublée d'un libellé (accessibilité, spec 10).
  return <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 text-xs font-semibold leading-5 ${tone}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{label}
  </span>;
}

function PillSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  // Sélecteur natif (feuille de choix système sur mobile) habillé en pastille.
  return (
    <label className="pill relative pr-7">
      <span className="sr-only">{label}</span>
      <span className="max-w-[11rem] truncate">{options.find(([v]) => v === value)?.[1] ?? label}</span>
      <svg className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      <select className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Chip({ on, strike, onClick, children }: { on: boolean; strike?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-sm ${on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface active:bg-surface-2"} ${on && strike ? "line-through" : ""}`}>
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
        <input className="input shadow-md md:shadow-none" type="search" enterKeyHint="search" placeholder={placeholder} aria-label={placeholder} value={q}
          role="combobox" aria-expanded={open && shown.length > 0} aria-controls="place-list" aria-autocomplete="list"
          onChange={(e) => setQ(e.target.value)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
            if (e.key === "Enter") { e.preventDefault(); choose(active >= 0 ? active : 0); }
            if (e.key === "Escape") setOpen(false);
          }} />
        {open && shown.length > 0 && (
          <ul id="place-list" role="listbox" className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {shown.map((it, i) => (
              <li key={i} role="option" aria-selected={i === active}
                className={`flex min-h-11 cursor-pointer items-center px-3 text-base md:min-h-9 md:text-sm ${i === active ? "bg-surface-2" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); choose(i); }}>
                {it.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className="btn-ghost shrink-0 px-3 shadow-md md:shadow-none" onClick={onAroundMe} title={aroundMe} aria-label={aroundMe}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>
        <span className="hidden lg:inline">{aroundMe}</span>
      </button>
    </div>
  );
}
