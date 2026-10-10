import type { FuelCode } from "@/lib/fuels";
import { parseIsoLocal } from "@/lib/time";
import { fetchWithRetry, type Connector, type RawStation } from "./types";

// API REST derrière precoscombustiveis.dgeg.gov.pt : pas de filtre géographique, un appel par district (18, continent seul).
const ENDPOINT = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos";
const DISTRICTS = Array.from({ length: 18 }, (_, i) => i + 1);

// Produit simple → code ; la variante « especial » ne sert que si la station ne vend pas la simple.
const PLAIN: Record<string, FuelCode> = {
  "Gasóleo simples": "B7", "Gasolina simples 95": "E5", "Gasolina 98": "E5_98", "GPL Auto": "LPG",
  "GNC (gás natural comprimido) - €/kg": "CNG", "GNL (gás natural liquefeito) - €/kg": "LNG",
};
const SPECIAL: Record<string, FuelCode> = { "Gasóleo especial": "B7_PREMIUM", "Gasolina especial 95": "E5", "Gasolina especial 98": "E5_98" };

type Row = {
  Id: number; Nome?: string; Marca?: string; TipoPosto?: string; Combustivel: string; Preco: string; DataAtualizacao?: string;
  Morada?: string; Localidade?: string; Municipio?: string; CodPostal?: string; Latitude?: number; Longitude?: number;
};

const price = (s: string) => Number(s.replace(/[^\d,.-]/g, "").replace(",", "."));
const clean = (s?: string) => s?.replace(/\s+/g, " ").trim() || null;

export function parsePt(rows: Row[]): RawStation[] {
  const by = new Map<number, Row[]>();
  for (const r of rows) (by.get(r.Id) ?? by.set(r.Id, []).get(r.Id)!).push(r);
  return [...by.values()].flatMap((rs) => {
    const r0 = rs[0];
    if (!r0.Latitude || !r0.Longitude) return [];
    const prices = new Map<FuelCode, { price: number; updatedAt: Date }>();
    const add = (fuel: FuelCode, r: Row, override: boolean) => {
      const p = price(r.Preco), at = parseIsoLocal(r.DataAtualizacao ?? "", "Europe/Lisbon");
      if (p > 0.3 && p < 5 && at && (override || !prices.has(fuel))) prices.set(fuel, { price: p, updatedAt: at });
    };
    for (const r of rs) if (PLAIN[r.Combustivel]) add(PLAIN[r.Combustivel], r, true);
    for (const r of rs) if (SPECIAL[r.Combustivel]) add(SPECIAL[r.Combustivel], r, SPECIAL[r.Combustivel] === "B7_PREMIUM");
    const brand = clean(r0.Marca);
    return [{
      externalId: String(r0.Id), name: clean(r0.Nome), brand: brand && !/^gen[ée]rico$/i.test(brand) ? brand : null,
      address: clean(r0.Morada), postalCode: clean(r0.CodPostal), city: clean(r0.Localidade) ?? clean(r0.Municipio),
      lat: r0.Latitude, lon: r0.Longitude, roadType: r0.TipoPosto === "Auto-estrada" ? "motorway" : "road",
      is24hAutomat: false, services: [], paymentMethods: [], outages: [],
      prices: [...prices].map(([fuel, v]) => ({ fuel, ...v })),
    }];
  });
}

export const pt: Connector = {
  id: "pt", country: "PT", name: "DGEG — Preços dos Combustíveis Online", currency: "EUR",
  license: "Dados abertos DGEG", attribution: "Direção-Geral de Energia e Geologia (DGEG)",
  url: "https://precoscombustiveis.dgeg.gov.pt/", schedule: "15 */2 * * *",
  async fetch() {
    const rows: Row[] = [];
    for (const d of DISTRICTS) {
      const res = await fetchWithRetry(`${ENDPOINT}?${new URLSearchParams({ idDistrito: String(d), qtdPorPagina: "10000", pagina: "1" })}`);
      const j = (await res.json()) as { status: boolean; resultado: Row[] };
      if (!j.status || !Array.isArray(j.resultado)) throw new Error(`PT: district ${d} refusé`);
      rows.push(...j.resultado);
    }
    return parsePt(rows);
  },
};
