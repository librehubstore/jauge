import { eq } from "drizzle-orm";
import { db } from "@/db";
import { setting } from "@/db/schema";

export const DEFAULT_SETTINGS = {
  allowed_email_domains: [] as string[],
  require_admin_approval: false,
  active_countries: ["FR", "ES", "IT"] as string[],
  stale_hours: 48,
  excluded_days: 7,
  ecb_rates: null as { date: string; rates: Record<string, number> } | null,
};
export type Settings = typeof DEFAULT_SETTINGS;

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const [row] = await db.select().from(setting).where(eq(setting.key, key));
  return (row?.value as Settings[K]) ?? DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.insert(setting).values({ key, value }).onConflictDoUpdate({ target: setting.key, set: { value } });
}

export function emailDomainAllowed(email: string, allowed: string[]) {
  if (!allowed.length) return true;
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  return allowed.some((d) => d.toLowerCase() === domain);
}

/** Récupère et enregistre les taux BCE du jour (appelé par le worker). */
export async function refreshEcbRates() {
  const { parseEcbXml } = await import("./fx");
  const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { signal: AbortSignal.timeout(20_000) });
  const rates = res.ok ? parseEcbXml(await res.text()) : null;
  if (!rates) throw new Error("ECB: taux indisponibles");
  await setSetting("ecb_rates", rates);
  return rates.date;
}
