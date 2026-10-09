import type { FuelCode } from "@/lib/fuels";
import { parseDmyLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawHours, type RawStation } from "./types";

const FUEL: Record<string, FuelCode> = {
  "Precio Gasoleo A": "B7", "Precio Gasoleo Premium": "B7_PREMIUM", "Precio Gasolina 95 E5": "E5",
  "Precio Gasolina 95 E10": "E10", "Precio Gasolina 98 E5": "E5_98", "Precio Gasolina 95 E85": "E85",
  "Precio Gases licuados del petróleo": "LPG", "Precio Gas Natural Comprimido": "CNG",
  "Precio Gas Natural Licuado": "LNG", "Precio Hidrogeno": "H2", "Precio Adblue": "ADBLUE",
  "Precio Diésel Renovable": "XTL",
};
const num = (s?: string) => (s ? Number(s.replace(",", ".")) : NaN);

/** "L-D: 07:00-22:00" ou "L-D: 24H" ; les horaires plus complexes ne sont pas interprétés. */
export function parseHorario(h: string): { is24: boolean; hours?: RawHours[] } {
  if (/^L-D:\s*24H$/i.test(h.trim())) return { is24: true };
  const m = h.trim().match(/^L-D:\s*(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return { is24: false };
  const opens = `${m[1].padStart(2, "0")}:${m[2]}`, closes = `${m[3].padStart(2, "0")}:${m[4]}`;
  return { is24: false, hours: Array.from({ length: 7 }, (_, weekday) => ({ weekday, opens, closes, isClosed: false })) };
}

export function parseEs(json: { Fecha: string; ListaEESSPrecio: Record<string, string>[] }): RawStation[] {
  // L'API ne donne qu'une date globale d'extraction : elle sert d'horodatage à tous les prix.
  const at = parseDmyLocal(json.Fecha, "Europe/Madrid") ?? new Date();
  return json.ListaEESSPrecio.flatMap((s) => {
    const lat = num(s["Latitud"]), lon = num(s["Longitud (WGS84)"]);
    if (!lat || !lon) return [];
    const { is24, hours } = parseHorario(s["Horario"] ?? "");
    const prices = Object.entries(FUEL).flatMap(([k, fuel]) => {
      const p = num(s[k]);
      return p > 0 ? [{ fuel, price: p, updatedAt: at }] : [];
    });
    return [{
      externalId: s["IDEESS"], name: s["Rótulo"] || null, brand: s["Rótulo"] || null,
      address: s["Dirección"] || null, postalCode: s["C.P."] || null, city: s["Localidad"] || null,
      lat, lon, roadType: "unknown" as const, is24hAutomat: is24, hours,
      services: prices.some((p) => p.fuel === "ADBLUE") ? ["adblue"] : [], paymentMethods: [],
      prices, outages: [],
    }];
  });
}

export const es: Connector = {
  id: "es", country: "ES", name: "MITECO — Geoportal Gasolineras", currency: "EUR",
  license: "Reutilización libre (Ley 37/2007)", attribution: "Ministerio para la Transición Ecológica y el Reto Demográfico",
  url: "https://geoportalgasolineras.es/", schedule: "*/30 * * * *",
  async fetch() {
    const res = await fetchWithRetry(
      "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/",
      { headers: { Accept: "application/json" } },
    );
    return parseEs(await res.json());
  },
};
