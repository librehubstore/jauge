import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { CONNECTORS } from "@/connectors";
import { db } from "@/db";
import { account, fuelType, source, user } from "@/db/schema";
import { FUELS } from "./fuels";
import { hashPassword } from "./password";

/** Premier lancement (idempotent) : schéma, référentiels, sources, administrateur initial. */
export async function bootstrap() {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS postgis`);
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.insert(fuelType)
    .values(FUELS.map((f, i) => ({ code: f.code, unit: f.unit, euSymbol: f.euSymbol, sort: i })))
    .onConflictDoNothing();

  for (const c of CONNECTORS) {
    const meta = { country: c.country, name: c.name, license: c.license, attribution: c.attribution, url: c.url, schedule: c.schedule };
    await db.insert(source).values({ id: c.id, ...meta }).onConflictDoUpdate({ target: source.id, set: meta });
  }

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return;
  const id = randomUUID();
  await db.insert(user).values({ id, email, name: "Admin", emailVerified: true, role: "admin", status: "active" });
  await db.insert(account).values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(password) });
  console.info(`[bootstrap] administrateur initial créé : ${email}`);
}
