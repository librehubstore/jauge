import { sql } from "drizzle-orm";
import { db } from "@/db";
import { csvResponse } from "@/lib/fuel-log";
import { currentUser } from "@/lib/session";

/** Export CSV de l'historique d'une station sur un an, tous carburants (un changement de prix par ligne). */
export async function GET(_req: Request, ctx: RouteContext<"/api/stations/[id]/history.csv">) {
  if (!(await currentUser())) return new Response("UNAUTHORIZED", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("BAD_REQUEST", { status: 400 });
  const rows = (await db.execute(sql`
    select fuel_code, price, currency, valid_from from price_history
    where station_id = ${id} and valid_from >= now() - interval '365 days'
    order by fuel_code, valid_from
  `)) as unknown as { fuel_code: string; price: string; currency: string; valid_from: Date }[];
  return csvResponse(`jauge-station-${id}-historique.csv`, ["valid_from", "fuel", "price", "currency"],
    rows.map((r) => [new Date(r.valid_from).toISOString(), r.fuel_code, r.price, r.currency]));
}
