// Plan carburant d'itinéraire (spec 4.7) : fonctions pures, unités en km et litres (ou kg).

export type Candidate = { id: number; km: number; price: number; detourKm: number };
export type PlanParams = { routeKm: number; tank: number; consumption: number; startLevel: number; reserve: number };
export type Strategy = "fewest" | "cheapest" | "balanced";
export type PlannedStop = Candidate & { amount: number; cost: number; arrivalFuel: number };
export type Plan = { feasible: boolean; stops: PlannedStop[]; amount: number; fuelCost: number; endFuel: number };

const EPS = 1e-6;

/** Carburant consommé entre deux points de la route, demi-détours compris (aller vers la station, retour sur la route). */
function leg(p: PlanParams, from: { km: number; detourKm: number } | null, to: { km: number; detourKm: number } | null) {
  const a = from?.km ?? 0, b = to?.km ?? p.routeKm;
  return ((b - a) + (from?.detourKm ?? 0) / 2 + (to?.detourKm ?? 0) / 2) * p.consumption / 100;
}

/** Simule une liste d'arrêts avec les quantités achetées ; vérifie la réserve à chaque arrivée et la capacité. */
export function evaluate(p: PlanParams, stops: { c: Candidate; amount: number }[]): Plan {
  const reserve = p.reserve * p.tank;
  let fuel = p.startLevel * p.tank, prev: Candidate | null = null, feasible = true, cost = 0, bought = 0;
  const out: PlannedStop[] = [];
  for (const { c, amount } of stops) {
    fuel -= leg(p, prev, c);
    if (fuel < reserve - EPS || fuel + amount > p.tank + EPS) feasible = false;
    out.push({ ...c, amount, cost: amount * c.price, arrivalFuel: fuel });
    fuel += amount;
    cost += amount * c.price;
    bought += amount;
    prev = c;
  }
  fuel -= leg(p, prev, null);
  if (fuel < reserve - EPS) feasible = false;
  return { feasible, stops: out, amount: bought, fuelCost: cost, endFuel: fuel };
}

/** Prix effectif : le carburant brûlé par le détour est réparti sur un demi-plein. */
const effective = (p: PlanParams, c: Candidate) => c.price * (1 + (c.detourKm * p.consumption / 100) / (p.tank / 2));

/**
 * Quantités optimales pour une suite d'arrêts fixée : à chaque arrêt, juste de quoi atteindre
 * le prochain arrêt moins cher de la suite ; sinon de quoi finir (dans la limite du réservoir).
 * Les arrêts devenus inutiles sont retirés et le calcul recommence.
 */
export function optimizeAmounts(p: PlanParams, seq: Candidate[]): Plan {
  const reserve = p.reserve * p.tank;
  let stops = seq;
  for (;;) {
    const amounts: number[] = [];
    let fuel = p.startLevel * p.tank;
    stops.forEach((c, i) => {
      fuel -= leg(p, stops[i - 1] ?? null, c);
      const k = stops.findIndex((t, j) => j > i && t.price < c.price);
      let need = reserve;
      for (let j = i; j < (k === -1 ? stops.length : k); j++) need += leg(p, stops[j], stops[j + 1] ?? null);
      const buy = Math.min(p.tank - fuel, Math.max(0, need - fuel));
      amounts.push(buy);
      fuel += buy;
    });
    const kept = stops.filter((_, i) => amounts[i] > 0.05);
    if (kept.length === stops.length) return evaluate(p, stops.map((c, i) => ({ c, amount: amounts[i] })));
    stops = kept;
  }
}

/** Retire les arrêts sans achat (leur détour ne sert à rien) puis réévalue. */
function finalize(p: PlanParams, plan: { c: Candidate; amount: number }[]) {
  return evaluate(p, plan.filter((s) => s.amount > 0.05));
}

/** Moins d'arrêts : on roule le plus loin possible, puis plein complet (juste le nécessaire au dernier arrêt). */
function fewest(p: PlanParams, cands: Candidate[]) {
  const reserve = p.reserve * p.tank;
  const plan: { c: Candidate; amount: number }[] = [];
  let at: Candidate | null = null, fuel = p.startLevel * p.tank;
  for (;;) {
    if (at) {
      const need = leg(p, at, null) + reserve - fuel;
      if (need <= p.tank - fuel + EPS) { plan[plan.length - 1].amount = Math.max(0, need); break; }
      plan[plan.length - 1].amount = p.tank - fuel;
      fuel = p.tank;
    } else if (fuel - leg(p, null, null) >= reserve - EPS) break;
    const from: Candidate | null = at;
    const reach: Candidate[] = cands.filter((c) => c.km > (from?.km ?? -1) && fuel - leg(p, from, c) >= reserve - EPS);
    if (!reach.length) return null;
    const next: Candidate = reach.reduce((x: Candidate, y: Candidate) => (y.km > x.km || (y.km === x.km && y.price < x.price) ? y : x));
    fuel -= leg(p, from, next);
    plan.push({ c: next, amount: 0 });
    at = next;
  }
  return finalize(p, plan);
}

export const STOP_PENALTY = 0.5; // coût fixe d'un arrêt (temps), en devise : évite les micro-arrêts
const LEVELS = 50; // réservoir discrétisé en 50 niveaux
const BIN_KM = 10;

/** Garde la station au meilleur prix effectif par tronçon de 10 km (réduit l'espace de recherche). */
function binned(p: PlanParams, cands: Candidate[]) {
  const bins = new Map<number, Candidate>();
  for (const c of cands) {
    const k = Math.floor(c.km / BIN_KM), cur = bins.get(k);
    if (!cur || effective(p, c) < effective(p, cur)) bins.set(k, c);
  }
  return [...bins.values()].sort((x, y) => x.km - y.km);
}

/** Coût minimal : programmation dynamique (station, niveau de départ), pénalité par arrêt. */
function cheapest(p: PlanParams, all: Candidate[]) {
  const cands = binned(p, all), n = cands.length, unit = p.tank / LEVELS, reserve = p.reserve * p.tank;
  const start = p.startLevel * p.tank;
  if (start - leg(p, null, null) >= reserve - EPS) return evaluate(p, []);
  // best[j][q] : coût minimal pour repartir de j avec q niveaux ; prev pour la reconstruction.
  const best = Array.from({ length: n }, () => new Float64Array(LEVELS + 1).fill(Infinity));
  const prev = Array.from({ length: n }, () => new Array<[number, number] | null>(LEVELS + 1).fill(null));
  const relax = (j: number, arrival: number, base: number, from: [number, number] | null) => {
    const qa = Math.floor((arrival + EPS) / unit);
    for (let q = qa + 1; q <= LEVELS; q++) {
      const c = base + (q * unit - arrival) * cands[j].price + STOP_PENALTY;
      if (c < best[j][q]) { best[j][q] = c; prev[j][q] = from; }
    }
  };
  for (let j = 0; j < n; j++) {
    const a = start - leg(p, null, cands[j]);
    if (a >= reserve - EPS) relax(j, a, 0, null);
  }
  let end: { cost: number; at: [number, number] } | null = null;
  for (let i = 0; i < n; i++) {
    for (let q = 0; q <= LEVELS; q++) {
      const base = best[i][q];
      if (!Number.isFinite(base)) continue;
      const fuel = q * unit;
      if (fuel - leg(p, cands[i], null) >= reserve - EPS && (!end || base < end.cost)) end = { cost: base, at: [i, q] };
      for (let j = i + 1; j < n; j++) {
        const a = fuel - leg(p, cands[i], cands[j]);
        if (a < reserve - EPS) break; // stations triées : les suivantes sont encore plus loin
        relax(j, a, base, [i, q]);
      }
    }
  }
  if (!end) return null;
  const path0: number[] = [];
  for (let cur: [number, number] | null = end.at; cur; cur = prev[cur[0]][cur[1]]) path0.unshift(cur[0]);
  const exact = optimizeAmounts(p, path0.map((j) => cands[j]));
  const two = balanced(p, all);
  return two && (!exact.feasible || two.fuelCost + STOP_PENALTY * two.stops.length <= exact.fuelCost + STOP_PENALTY * exact.stops.length) ? two : exact;
}


/** Équilibré : au plus 2 arrêts, coût minimal sous cette contrainte (énumération). */
function balanced(p: PlanParams, cands: Candidate[]): Plan | null {
  const reserve = p.reserve * p.tank, start = p.startLevel * p.tank;
  let best = null as Plan | null;
  const consider = (plan: Plan) => {
    if (plan.feasible && (!best || plan.fuelCost < best.fuelCost - EPS || (Math.abs(plan.fuelCost - best.fuelCost) < EPS && plan.stops.length < best.stops.length))) best = plan;
  };
  consider(evaluate(p, []));
  for (const a of cands) {
    const fa = start - leg(p, null, a);
    if (fa < reserve - EPS) continue;
    consider(evaluate(p, [{ c: a, amount: Math.min(p.tank - fa, Math.max(0, leg(p, a, null) + reserve - fa)) }]));
    for (const b of cands) {
      if (b.km <= a.km) continue;
      const ab = leg(p, a, b), bEnd = leg(p, b, null);
      // Le moins cher des deux reçoit le plus possible.
      const x = a.price <= b.price
        ? Math.min(p.tank - fa, Math.max(0, ab + bEnd + reserve - fa))
        : Math.min(p.tank - fa, Math.max(0, ab + reserve - fa));
      const fb = fa + x - ab;
      const y = Math.min(p.tank - fb, Math.max(0, bEnd + reserve - fb));
      if (y > 0.05 || x > 0.05) consider(evaluate(p, [{ c: a, amount: x }, { c: b, amount: y }].filter((s) => s.amount > 0.05)));
    }
  }
  return best;
}

export function planFuel(strategy: Strategy, params: PlanParams, candidates: Candidate[]): Plan | null {
  const cands = [...candidates].filter((c) => c.km >= 0 && c.km <= params.routeKm).sort((a, b) => a.km - b.km);
  const plan = strategy === "fewest" ? fewest(params, cands) : strategy === "cheapest" ? cheapest(params, cands) : balanced(params, cands);
  return plan?.feasible ? plan : null;
}
