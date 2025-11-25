-- Seed subscription tiers
-- This migration ensures that the free and pro tiers exist in the database

-- Insert free tier (idempotent)
INSERT INTO "subscription_tiers" ("name", "display_name", "max_secrets", "max_recipients_per_secret", "custom_intervals", "price_monthly", "price_yearly")
VALUES ('free', 'Free', 1, 1, false, NULL, NULL)
ON CONFLICT ("name") DO UPDATE SET
  "display_name" = EXCLUDED."display_name",
  "max_secrets" = EXCLUDED."max_secrets",
  "max_recipients_per_secret" = EXCLUDED."max_recipients_per_secret",
  "custom_intervals" = EXCLUDED."custom_intervals",
  "price_monthly" = EXCLUDED."price_monthly",
  "price_yearly" = EXCLUDED."price_yearly",
  "updated_at" = NOW();

-- Pro tier commented out - 'pro' enum value doesn't exist yet in initial schema
-- Uncomment after adding 'pro' to subscription_tier enum manually
-- INSERT INTO "subscription_tiers" ("name", "display_name", "max_secrets", "max_recipients_per_secret", "custom_intervals", "price_monthly", "price_yearly")
-- VALUES ('pro', 'Pro', 10, 5, true, 9.00, 90.00)
-- ON CONFLICT ("name") DO UPDATE SET
--   "display_name" = EXCLUDED."display_name",
--   "max_secrets" = EXCLUDED."max_secrets",
--   "max_recipients_per_secret" = EXCLUDED."max_recipients_per_secret",
--   "custom_intervals" = EXCLUDED."custom_intervals",
--   "price_monthly" = EXCLUDED."price_monthly",
--   "price_yearly" = EXCLUDED."price_yearly",
--   "updated_at" = NOW();
