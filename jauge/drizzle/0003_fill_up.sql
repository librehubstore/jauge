CREATE TABLE "fill_up" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vehicle_id" integer NOT NULL,
	"station_id" integer,
	"filled_at" timestamp with time zone NOT NULL,
	"fuel_code" text NOT NULL,
	"amount" double precision NOT NULL,
	"total_cost" numeric(9, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"odometer_km" integer,
	"full_tank" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fill_up" ADD CONSTRAINT "fill_up_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fill_up" ADD CONSTRAINT "fill_up_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fill_up" ADD CONSTRAINT "fill_up_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fill_up" ADD CONSTRAINT "fill_up_fuel_code_fuel_type_code_fk" FOREIGN KEY ("fuel_code") REFERENCES "public"."fuel_type"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fill_up_vehicle_idx" ON "fill_up" USING btree ("vehicle_id","filled_at");