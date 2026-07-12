ALTER TABLE "bitcoin_utxos" ADD COLUMN "encrypted_recovery_tx" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "recovery_sender_pubkey" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "recipient_address" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "network" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "generation_key" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD COLUMN "recovery_manifest" jsonb;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "nostr_publisher_pubkey" text;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "nostr_gift_wrap_event_id" text;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "nostr_capsule_event_id" text;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "nostr_manifest_event" jsonb;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "nostr_scheme_version" integer;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "nostr_delivery_status" text;--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "bitcoin_delivery_status" text;--> statement-breakpoint
ALTER TABLE "bitcoin_utxos" ADD CONSTRAINT "bitcoin_utxos_generation_key_unique" UNIQUE("generation_key");