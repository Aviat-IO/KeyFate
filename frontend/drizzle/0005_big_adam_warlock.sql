DO $$ BEGIN
 ALTER TABLE "secret_recipients" ALTER COLUMN "email" DROP NOT NULL;
EXCEPTION
 WHEN others THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN IF NOT EXISTS "phone" text;