CREATE TYPE "public"."bitcoin_utxo_status" AS ENUM('pending', 'confirmed', 'spent', 'expired');--> statement-breakpoint
CREATE TABLE "bitcoin_utxos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret_id" uuid NOT NULL,
	"tx_id" text NOT NULL,
	"output_index" integer NOT NULL,
	"amount_sats" integer NOT NULL,
	"timelock_script" text NOT NULL,
	"owner_pubkey" text NOT NULL,
	"recipient_pubkey" text NOT NULL,
	"ttl_blocks" integer NOT NULL,
	"status" bitcoin_utxo_status DEFAULT 'pending' NOT NULL,
	"pre_signed_recipient_tx" text,
	"confirmed_at" timestamp,
	"spent_at" timestamp,
	"spent_by_tx_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD CONSTRAINT "bitcoin_utxos_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bitcoin_utxos_secret" ON "bitcoin_utxos" USING btree ("secret_id");--> statement-breakpoint
CREATE INDEX "idx_bitcoin_utxos_status" ON "bitcoin_utxos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bitcoin_utxos_tx" ON "bitcoin_utxos" USING btree ("tx_id","output_index");