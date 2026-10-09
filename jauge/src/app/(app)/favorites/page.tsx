import { and, eq, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { vehicle } from "@/db/schema";
import { FavoritesList } from "@/components/FavoritesList";
import { requireUser } from "@/lib/session";

export default async function FavoritesPage() {
  const u = await requireUser();
  const t = await getTranslations("favorites");
  const [v] = await db.select().from(vehicle).where(and(eq(vehicle.userId, u.id), eq(vehicle.isDefault, true)));
  const fuel = v?.fuelCode ?? u.preferences.defaultFuel ?? "B7";

  // Prix du jour du carburant actif et prix en vigueur il y a 24 h (pour l'écart).
  const rows = (await db.execute(sql`
    select s.id, coalesce(b.name, s.name, s.city) as label, s.address, s.city, s.country,
      p.price, p.currency, p.source_updated_at,
      (select h.price from price_history h where h.station_id = s.id and h.fuel_code = ${fuel}
        and h.valid_from <= now() - interval '24 hours' order by h.valid_from desc limit 1) as yesterday
    from favorite f
    join station s on s.id = f.station_id
    left join brand b on b.id = s.brand_id
    left join station_fuel_price p on p.station_id = s.id and p.fuel_code = ${fuel} and not p.quarantined
    where f.user_id = ${u.id}
    order by f.created_at desc
  `)) as unknown as {
    id: number; label: string | null; address: string | null; city: string | null; country: string;
    price: string | null; currency: string | null; source_updated_at: Date | null; yesterday: string | null;
  }[];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
        <FavoritesList fuel={fuel} items={rows.map((r) => ({
          id: r.id, label: r.label ?? "—", address: [r.address, r.city, r.country].filter(Boolean).join(", "),
          price: r.price === null ? null : Number(r.price), currency: r.currency ?? "EUR",
          updatedAt: r.source_updated_at ? new Date(r.source_updated_at).toISOString() : null,
          change: r.price !== null && r.yesterday !== null ? Number(r.price) - Number(r.yesterday) : null,
        }))} />
      </div>
    </div>
  );
}
