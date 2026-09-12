CREATE TABLE "source_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source" "source_channel" NOT NULL,
	"spend_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_spend" ADD CONSTRAINT "source_spend_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_spend_tenant_idx" ON "source_spend" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_spend_tenant_source_unique" ON "source_spend" USING btree ("tenant_id","source");