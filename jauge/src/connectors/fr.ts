import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import type { FuelCode } from "@/lib/fuels";
import { parseIsoLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

const TZ = "Europe/Paris";
const FUEL: Record<string, FuelCode> = { Gazole: "B7", SP95: "E5", SP98: "E5_98", E10: "E10", E85: "E85", GPLc: "LPG" };
const SERVICE: Record<string, string> = {
  "Station de gonflage": "inflation", "Lavage automatique": "wash", "Lavage manuel": "wash",
  "Boutique alimentaire": "shop", "Boutique non alimentaire": "shop", "Toilettes publiques": "toilets",
  "Bornes électriques": "ev", "Restauration à emporter": "food", "Restauration sur place": "food",
  "DAB (Distributeur automatique de billets)": "atm", "Piste poids lourds": "truck", Wifi: "wifi",
  "Services réparation / entretien": "repair", "Vente de gaz domestique (Butane, Propane)": "lpg_bottle",
  "Carburant additivé": "premium_fuel", "Aire de camping-cars": "camper", "Automate CB 24/24": "card24",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type X = any;
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]);
// Coordonnées PTV (×100 000), parfois déjà en degrés.
const coord = (v: string) => { const n = Number(v); return Math.abs(n) > 1000 ? n / 100000 : n; };
const hhmm = (v?: string) => (v ? v.replace(".", ":").padStart(5, "0") : null);

export function parseFr(xmlBytes: Uint8Array): RawStation[] {
  const xml = new TextDecoder("latin1").decode(xmlBytes);
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseAttributeValue: false, parseTagValue: false })
    .parse(xml);
  const out: RawStation[] = [];
  for (const p of arr<X>(doc.pdv_liste?.pdv)) {
    const lat = coord(p.latitude), lon = coord(p.longitude);
    if (!lat || !lon) continue;
    const services = [...new Set(arr<string>(p.services?.service).map((s) => SERVICE[s]).filter(Boolean))];
    const hours = arr<X>(p.horaires?.jour).map((j) => {
      const h = arr<X>(j.horaire)[0];
      const closed = j.ferme === "1";
      return { weekday: Number(j.id) - 1, opens: closed ? null : hhmm(h?.ouverture), closes: closed ? null : hhmm(h?.fermeture), isClosed: closed };
    });
    const prices = arr<X>(p.prix).flatMap((x) => {
      const fuel = FUEL[x.nom]; const at = parseIsoLocal(x.maj ?? "", TZ);
      return fuel && at && x.valeur ? [{ fuel, price: Number(x.valeur), updatedAt: at }] : [];
    });
    const outages = arr<X>(p.rupture).flatMap((r) => {
      const fuel = FUEL[r.nom]; const at = parseIsoLocal(r.debut ?? "", TZ);
      // Une rupture terminée (fin renseignée) n'est plus active.
      const kind = r.type === "definitive" ? ("permanent" as const) : ("temporary" as const);
      return fuel && at && !r.fin ? [{ fuel, kind, startedAt: at }] : [];
    });
    const fermeture = arr<X>(p.fermeture)[0];
    out.push({
      externalId: String(p.id), address: p.adresse || null, postalCode: p.cp || null, city: p.ville || null,
      lat, lon, roadType: p.pop === "A" ? "motorway" : p.pop === "R" ? "road" : "unknown",
      is24hAutomat: p.horaires?.["automate-24-24"] === "1", services,
      paymentMethods: services.includes("card24") ? ["card24"] : [],
      hours, prices, outages,
      status: fermeture && !fermeture.fin ? (fermeture.type === "D" ? "closed" : "closed_temp") : "active",
    });
  }
  return out;
}

export const fr: Connector = {
  id: "fr", country: "FR", name: "prix-carburants.gouv.fr", currency: "EUR",
  license: "Licence Ouverte 2.0", attribution: "Ministère de l'Économie — prix-carburants.gouv.fr",
  url: "https://www.prix-carburants.gouv.fr/rubrique/opendata/", schedule: "*/10 * * * *",
  async fetch() {
    const res = await fetchWithRetry("https://donnees.roulez-eco.fr/opendata/instantane_ruptures");
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const xml = Object.entries(files).find(([n]) => n.endsWith(".xml"));
    if (!xml) throw new Error("FR: aucun XML dans l'archive");
    return parseFr(xml[1]);
  },
};
