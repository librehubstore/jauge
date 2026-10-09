import { sql } from "drizzle-orm";
import {
  bigint, boolean, customType, doublePrecision, index, integer, jsonb, numeric, pgTable,
  primaryKey, serial, smallint, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** Point WGS84 (SRID 4326) ; drizzle-kit ignore le SRID du type geometry natif. Lecture : EWKB hexadécimal. */
const point4326 = customType<{ data: { x: number; y: number }; driverData: string }>({
  dataType: () => "geometry(Point, 4326)",
  toDriver: (v) => sql`ST_SetSRID(ST_MakePoint(${v.x}, ${v.y}), 4326)`,
  fromDriver(hex) {
    const b = Buffer.from(hex, "hex");
    const le = b[0] === 1;
    const type = le ? b.readUInt32LE(1) : b.readUInt32BE(1);
    const off = type & 0x20000000 ? 9 : 5; // présence du SRID
    const rd = (o: number) => (le ? b.readDoubleLE(o) : b.readDoubleBE(o));
    return { x: rd(off), y: rd(off + 8) };
  },
});

// ---------- Auth (Better Auth tables + champs métier) ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  role: text("role").notNull().default("user"), // user | moderator | admin
  status: text("status").notNull().default("pending_verification"), // pending_verification | pending_approval | active | disabled
  locale: text("locale").notNull().default("fr"),
  preferences: jsonb("preferences").$type<Preferences>().notNull().default({}),
  reputation: integer("reputation").notNull().default(0),
});

export type Preferences = {
  distanceUnit?: "km" | "mi";
  defaultFuel?: string;
  radiusKm?: number;
  navApp?: "google" | "apple" | "waze" | "osm";
  theme?: "system" | "light" | "dark";
};

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------- Référentiels ----------

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const fuelType = pgTable("fuel_type", {
  code: text("code").primaryKey(), // E5, E10, E5_98, E85, B7, B7_PREMIUM, B10, XTL, LPG, CNG, LNG, H2, ADBLUE
  unit: text("unit").notNull().default("L"), // L | kg
  euSymbol: text("eu_symbol"),
  sort: smallint("sort").notNull().default(0),
});

export const source = pgTable("source", {
  id: text("id").primaryKey(), // ex. "fr", "es", "it"
  country: text("country").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("official"),
  license: text("license").notNull(),
  attribution: text("attribution").notNull(),
  url: text("url"),
  schedule: text("schedule").notNull(), // cron
  enabled: boolean("enabled").notNull().default(true),
  lastSuccessAt: ts("last_success_at"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
});

export const ingestionRun = pgTable("ingestion_run", {
  id: serial("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => source.id),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  status: text("status").notNull().default("running"), // running | success | error
  stationsUpserted: integer("stations_upserted").notNull().default(0),
  pricesChanged: integer("prices_changed").notNull().default(0),
  error: text("error"),
}, (t) => [index("ingestion_run_source_idx").on(t.sourceId, t.startedAt)]);

export const brand = pgTable("brand", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// ---------- Stations & prix ----------

export const station = pgTable("station", {
  id: serial("id").primaryKey(),
  sourceId: text("source_id").notNull().references(() => source.id),
  externalId: text("external_id").notNull(),
  country: text("country").notNull(),
  name: text("name"),
  brandId: integer("brand_id").references(() => brand.id),
  brandOrigin: text("brand_origin"), // source | osm | community
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  location: point4326("location").notNull(),
  roadType: text("road_type").notNull().default("unknown"), // road | motorway | unknown
  is24hAutomat: boolean("is_24h_automat").notNull().default(false),
  services: text("services").array().notNull().default(sql`'{}'`),
  paymentMethods: text("payment_methods").array().notNull().default(sql`'{}'`),
  status: text("status").notNull().default("active"), // active | closed_temp | closed | inactive
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("station_source_ext_idx").on(t.sourceId, t.externalId),
  index("station_geo_idx").using("gist", sql`(${t.location}::geography)`),
]);

export const openingHours = pgTable("opening_hours", {
  stationId: integer("station_id").notNull().references(() => station.id, { onDelete: "cascade" }),
  weekday: smallint("weekday").notNull(), // 0 = lundi … 6 = dimanche
  opens: text("opens"), // "HH:MM"
  closes: text("closes"),
  isClosed: boolean("is_closed").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.stationId, t.weekday] })]);

export const stationFuelPrice = pgTable("station_fuel_price", {
  stationId: integer("station_id").notNull().references(() => station.id, { onDelete: "cascade" }),
  fuelCode: text("fuel_code").notNull().references(() => fuelType.code),
  price: numeric("price", { precision: 7, scale: 3, mode: "number" }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  sourceUpdatedAt: ts("source_updated_at").notNull(),
  ingestedAt: ts("ingested_at").notNull().defaultNow(),
  origin: text("origin").notNull().default("official"), // official | community
  quarantined: boolean("quarantined").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.stationId, t.fuelCode] })]);

export const priceHistory = pgTable("price_history", {
  stationId: integer("station_id").notNull().references(() => station.id, { onDelete: "cascade" }),
  fuelCode: text("fuel_code").notNull(),
  price: numeric("price", { precision: 7, scale: 3, mode: "number" }).notNull(),
  currency: text("currency").notNull().default("EUR"),
  validFrom: ts("valid_from").notNull(),
}, (t) => [primaryKey({ columns: [t.stationId, t.fuelCode, t.validFrom] })]);

export const outage = pgTable("outage", {
  id: serial("id").primaryKey(),
  stationId: integer("station_id").notNull().references(() => station.id, { onDelete: "cascade" }),
  fuelCode: text("fuel_code").notNull(),
  kind: text("kind").notNull().default("temporary"), // temporary | permanent
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  origin: text("origin").notNull().default("official"),
  reportedBy: text("reported_by").references(() => user.id, { onDelete: "set null" }),
}, (t) => [index("outage_station_idx").on(t.stationId)]);

// ---------- Données utilisateur ----------

export const vehicle = pgTable("vehicle", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fuelCode: text("fuel_code").notNull().references(() => fuelType.code),
  secondaryFuelCode: text("secondary_fuel_code").references(() => fuelType.code),
  tankCapacity: doublePrecision("tank_capacity").notNull(),
  consumptionPer100km: doublePrecision("consumption_per_100km").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

export const favorite = pgTable("favorite", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  stationId: integer("station_id").notNull().references(() => station.id, { onDelete: "cascade" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.stationId] })]);

export const contribution = pgTable("contribution", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  stationId: integer("station_id").references(() => station.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // outage | price | closed | brand_change | missing_station | hours
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"), // pending | published | rejected | expired
  moderatorId: text("moderator_id").references(() => user.id, { onDelete: "set null" }),
  reason: text("reason"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const notification = pgTable("notification", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  readAt: ts("read_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notification_user_idx").on(t.userId, t.createdAt)]);

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  data: jsonb("data"),
  createdAt: ts("created_at").notNull().defaultNow(),
});
