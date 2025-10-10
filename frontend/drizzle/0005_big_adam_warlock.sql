ALTER TABLE "secret_recipients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "secret_recipients" ADD COLUMN "phone" text;