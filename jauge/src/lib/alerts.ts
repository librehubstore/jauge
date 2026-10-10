import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { priceAlert, user } from "@/db/schema";
import { sendMail } from "./mail";
import { notify } from "./notify";

export const ALERT_COOLDOWN_MS = 24 * 3_600_000;

type AlertState = { threshold: number; armed: boolean; lastTriggeredAt: Date | null };

/**
 * Décision pure (spec 4.8) : déclenche quand le meilleur prix passe sous le seuil, au plus une fois
 * par 24 h ; l'alerte se réarme quand le prix repasse au-dessus.
 */
export function decideAlert(a: AlertState, best: number | null, now: Date): "trigger" | "rearm" | null {
  if (best === null) return null;
  if (best < a.threshold) {
    const cooled = !a.lastTriggeredAt || now.getTime() - a.lastTriggeredAt.getTime() >= ALERT_COOLDOWN_MS;
    return a.armed && cooled ? "trigger" : null;
  }
  return a.armed ? null : "rearm";
}

type Row = {
  id: number; user_id: string; fuel_code: string; threshold: string; armed: boolean; last_triggered_at: Date | null;
  station_id: number | null; price: string | null; currency: string | null; station_label: string | null;
};

/** Évalue toutes les alertes actives contre les prix récents (< 7 j, hors quarantaine). */
export async function evaluateAlerts(now = new Date()) {
  const rows = (await db.execute(sql`
    select a.id, a.user_id, a.fuel_code, a.threshold, a.armed, a.last_triggered_at,
      b.station_id, b.price, b.currency, b.station_label
    from price_alert a
    left join lateral (
      select p.station_id, p.price, p.currency, coalesce(br.name, s.name, s.city) as station_label
      from station_fuel_price p
      join station s on s.id = p.station_id
      left join brand br on br.id = s.brand_id
      where p.fuel_code = a.fuel_code and not p.quarantined and s.status = 'active'
        and p.source_updated_at > now() - interval '7 days'
        and (
          (a.scope = 'station' and p.station_id = a.station_id)
          or (a.scope = 'favorites' and exists (select 1 from favorite f where f.user_id = a.user_id and f.station_id = s.id))
          or (a.scope = 'area' and ST_DWithin(s.location::geography, a.center::geography, a.radius_km * 1000))
        )
      order by p.price limit 1
    ) b on true
    where a.active
  `)) as unknown as Row[];

  let triggered = 0;
  for (const r of rows) {
    const best = r.price === null ? null : Number(r.price);
    const d = decideAlert({ threshold: Number(r.threshold), armed: r.armed, lastTriggeredAt: r.last_triggered_at }, best, now);
    if (d === "rearm") await db.update(priceAlert).set({ armed: true }).where(eq(priceAlert.id, r.id));
    if (d !== "trigger") continue;
    triggered++;
    await db.update(priceAlert).set({ armed: false, lastTriggeredAt: now }).where(eq(priceAlert.id, r.id));
    const payload = { stationId: r.station_id, station: r.station_label ?? "", fuel: r.fuel_code, price: best, currency: r.currency ?? "EUR", threshold: Number(r.threshold) };
    await notify(r.user_id, "price_alert", payload);
    const [u] = await db.select().from(user).where(eq(user.id, r.user_id));
    if (u?.preferences.emailAlerts) {
      const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
      await sendMail("alert", { email: u.email, name: u.name, locale: u.locale }, `${base}/station/${r.station_id}`, {
        station: payload.station, price: best!.toFixed(3), currency: payload.currency,
      }).catch((e) => console.error("[alert] email", e));
    }
  }
  return { evaluated: rows.length, triggered };
}
