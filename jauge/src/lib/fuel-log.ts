// Statistiques du journal de pleins (spec 4.13) : fonctions pures.

export type FillEntry = { filledAt: Date; amount: number; totalCost: number; odometerKm: number | null; fullTank: boolean };

export type Segment = { fromKm: number; toKm: number; distance: number; amount: number; cost: number; per100: number };

/**
 * Consommation réelle, méthode « plein à plein » : entre deux pleins complets, la quantité versée
 * depuis le premier (exclu) jusqu'au second (inclus) correspond à la distance parcourue.
 * Un plein partiel est cumulé dans le segment en cours ; un kilométrage manquant ou en recul
 * interrompt le calcul (segment ignoré).
 */
export function consumptionSegments(entries: FillEntry[]): Segment[] {
  const sorted = [...entries].sort((a, b) => +a.filledAt - +b.filledAt);
  const out: Segment[] = [];
  let anchor: FillEntry | null = null, amount = 0, cost = 0;
  for (const e of sorted) {
    if (!anchor) {
      if (e.fullTank && e.odometerKm !== null) anchor = e;
      continue;
    }
    if (e.odometerKm !== null && e.odometerKm <= anchor.odometerKm!) {
      // Kilométrage incohérent : on repart de ce plein s'il est complet.
      anchor = e.fullTank ? e : null;
      amount = 0; cost = 0;
      continue;
    }
    amount += e.amount;
    cost += e.totalCost;
    if (!e.fullTank) continue;
    if (e.odometerKm === null) { anchor = null; amount = 0; cost = 0; continue; }
    const distance = e.odometerKm - anchor.odometerKm!;
    out.push({ fromKm: anchor.odometerKm!, toKm: e.odometerKm, distance, amount, cost, per100: (amount / distance) * 100 });
    anchor = e; amount = 0; cost = 0;
  }
  return out;
}

export type LogStats = {
  avgPer100: number | null; costPer100: number | null; distance: number;
  totalAmount: number; totalCost: number; avgUnitPrice: number | null;
  byMonth: { month: string; cost: number; amount: number }[];
};

export function logStats(entries: FillEntry[]): LogStats {
  const seg = consumptionSegments(entries);
  const dist = seg.reduce((s, x) => s + x.distance, 0);
  const segAmount = seg.reduce((s, x) => s + x.amount, 0);
  const segCost = seg.reduce((s, x) => s + x.cost, 0);
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const months = new Map<string, { cost: number; amount: number }>();
  for (const e of entries) {
    const m = e.filledAt.toISOString().slice(0, 7);
    const cur = months.get(m) ?? { cost: 0, amount: 0 };
    cur.cost += e.totalCost; cur.amount += e.amount;
    months.set(m, cur);
  }
  return {
    avgPer100: dist > 0 ? (segAmount / dist) * 100 : null,
    costPer100: dist > 0 ? (segCost / dist) * 100 : null,
    distance: dist, totalAmount, totalCost,
    avgUnitPrice: totalAmount > 0 ? totalCost / totalAmount : null,
    byMonth: [...months].sort(([a], [b]) => b.localeCompare(a)).map(([month, v]) => ({ month, ...v })),
  };
}

/** Échappe une valeur pour un CSV (séparateur « ; », adapté aux tableurs européens) et neutralise les formules. */
/** Réponse CSV téléchargeable : séparateur « ; » et BOM pour Excel en français. */
export const csvResponse = (filename: string, header: string[], rows: unknown[][]) =>
  new Response("\uFEFF" + [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"` },
  });

export const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
