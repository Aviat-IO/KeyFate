CREATE INDEX IF NOT EXISTS "idx_verification_tokens_identifier_purpose_expires" 
  ON "verification_tokens" USING btree ("identifier", "purpose", "expires") 
  WHERE "expires" > NOW();

CREATE INDEX IF NOT EXISTS "idx_verification_tokens_expires" 
  ON "verification_tokens" USING btree ("expires") 
  WHERE "expires" <= NOW();
