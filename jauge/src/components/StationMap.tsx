"use client";

import { LngLat, Map as MlMap, NavigationControl, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

export type MapPoint = { id: number; lat: number; lon: number; tier: 0 | 1 | 2 | null; label: string };

// ponytail: instance publique OpenFreeMap (sans clé) ; MAP_STYLE pour un serveur de tuiles auto-hébergé.
const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";

type Props = {
  center: { lat: number; lon: number; zoom?: number; seq: number };
  me: { lat: number; lon: number } | null;
  points: MapPoint[];
  highlightId: number | null;
  onSelect: (id: number) => void;
  onUserMove: (c: { lat: number; lon: number; radiusKm: number }) => void;
  recenterLabel: string;
  onRecenter: () => void;
};

export function StationMap({ center, me, points, highlightId, onSelect, onUserMove, recenterLabel, onRecenter }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);
  const cb = useRef({ onSelect, onUserMove });
  cb.current = { onSelect, onUserMove };
  const latest = useRef({ points, me, highlightId });
  latest.current = { points, me, highlightId };

  useEffect(() => {
    const m = new MlMap({
      container: el.current!, style: STYLE, center: [center.lon, center.lat], zoom: center.zoom ?? 12,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.on("error", (e) => console.error("[map]", e.error?.message ?? e));
    if (process.env.NODE_ENV !== "production") (window as unknown as { __map?: MlMap }).__map = m;
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("stations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addSource("me", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "me", type: "circle", source: "me",
        paint: { "circle-radius": 7, "circle-color": "#2563eb", "circle-stroke-width": 3, "circle-stroke-color": "#fff" },
      });
      m.addLayer({
        id: "st", type: "circle", source: "stations",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 13, 8],
          "circle-color": ["match", ["get", "tier"], 0, cssVar("--tier-0"), 1, cssVar("--tier-1"), 2, cssVar("--tier-2"), cssVar("--tier-none")],
          "circle-stroke-width": 1.5, "circle-stroke-color": "#fff",
        },
      });
      m.addLayer({
        id: "st-hl", type: "circle", source: "stations", filter: ["==", ["get", "id"], -1],
        paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": cssVar("--fg") },
      });
      m.addLayer({
        id: "st-label", type: "symbol", source: "stations", minzoom: 11.5,
        layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-offset": [0, -1.3], "text-allow-overlap": false },
        paint: { "text-color": "#1c1b18", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });
      m.on("click", "st", (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id; if (id) cb.current.onSelect(Number(id)); });
      m.on("mouseenter", "st", () => { m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "st", () => { m.getCanvas().style.cursor = ""; });
      ready.current = true;
      sync();
    });
    // Déplacement par l'utilisateur uniquement (pas les flyTo programmatiques).
    m.on("moveend", (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      const c = m.getCenter(), b = m.getBounds();
      const diagKm = LngLat.convert(b.getNorthEast()).distanceTo(b.getSouthWest()) / 1000;
      cb.current.onUserMove({ lat: c.lat, lon: c.lng, radiusKm: Math.min(50, Math.max(1, Math.round(diagKm / 2))) });
    });
    return () => { ready.current = false; m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const m = map.current;
    if (!m || !ready.current) return;
    const { points, me, highlightId } = latest.current;
    (m.getSource("stations") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { id: p.id, tier: p.tier ?? -1, label: p.label },
      })),
    });
    (m.getSource("me") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: me ? [{ type: "Feature", geometry: { type: "Point", coordinates: [me.lon, me.lat] }, properties: {} }] : [],
    });
    m.setFilter("st-hl", ["==", ["get", "id"], highlightId ?? -1]);
  }

  useEffect(sync, [points, me, highlightId]);

  useEffect(() => {
    map.current?.flyTo({ center: [center.lon, center.lat], zoom: center.zoom ?? 12, duration: 600 });
  }, [center.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full">
      <div ref={el} className="h-full w-full" />
      <button type="button" onClick={onRecenter} aria-label={recenterLabel} title={recenterLabel}
        className="absolute bottom-6 right-2.5 rounded-md border border-border bg-surface p-2 shadow-sm hover:bg-surface-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" />
        </svg>
      </button>
    </div>
  );
}
