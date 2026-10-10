CREATE TABLE "price_alert" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"station_id" integer,
	"center" geometry(Point, 4326),
	"label" text,
	"radius_km" double precision,
	"fuel_code" text NOT NULL,
	"threshold" numeric(7, 3) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"armed" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_alert" ADD CONSTRAINT "price_alert_fuel_code_fuel_type_code_fk" FOREIGN KEY ("fuel_code") REFERENCES "public"."fuel_type"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_alert_active_idx" ON "price_alert" USING btree ("active");