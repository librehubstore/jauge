import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { vehicle } from "@/db/schema";
import { VehicleManager } from "@/components/VehicleManager";
import { requireUser } from "@/lib/session";

export default async function VehiclesPage() {
  const u = await requireUser();
  const t = await getTranslations("vehicles");
  const vehicles = await db.select().from(vehicle).where(eq(vehicle.userId, u.id)).orderBy(vehicle.id);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
        <VehicleManager vehicles={vehicles} />
      </div>
    </div>
  );
}
