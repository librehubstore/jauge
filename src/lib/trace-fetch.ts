// Trace des appels HTTP sortants (sources de prix, Photon, Brevo, itinéraires) : une ligne JSON par appel
// sur la sortie standard, lisible avec `docker compose logs app worker | grep '"t":"fetch"'`.
const SECRET = /key|token|secret|pass|auth|sig/i;

/** URL sans les valeurs des paramètres sensibles (clé Tankerkönig, jetons…). */
export function redactUrl(raw: string) {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()]) if (SECRET.test(k)) u.searchParams.set(k, "***");
    return u.toString();
  } catch {
    return raw;
  }
}

export function traceFetch(log: (line: string) => void = console.log) {
  const orig = globalThis.fetch as typeof fetch & { traced?: true };
  if (orig.traced) return;
  const traced = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = redactUrl(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const start = performance.now();
    const write = (extra: object) =>
      log(JSON.stringify({ t: "fetch", at: new Date().toISOString(), method, url, ms: Math.round(performance.now() - start), ...extra }));
    try {
      const res = await orig(input, init);
      write({ status: res.status });
      return res;
    } catch (e) {
      write({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  };
  globalThis.fetch = Object.assign(traced, { traced: true as const });
}
