-- Add policy document versioning system for legal compliance
-- Stores exact content of policies that users accepted

-- Create policy document type enum
CREATE TYPE "policy_document_type" AS ENUM('privacy_policy', 'terms_of_service');

-- Create policy documents table
CREATE TABLE IF NOT EXISTS "policy_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "policy_document_type" NOT NULL,
	"version" text NOT NULL,
	"content" text NOT NULL,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	UNIQUE("type", "version")
);

-- Add foreign keys to privacy_policy_acceptance to reference exact documents
ALTER TABLE "privacy_policy_acceptance" 
ADD COLUMN "policy_document_id" uuid REFERENCES "policy_documents"("id"),
ADD COLUMN "terms_document_id" uuid REFERENCES "policy_documents"("id");

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "policy_documents_type_version_idx" ON "policy_documents" ("type", "version");
CREATE INDEX IF NOT EXISTS "policy_documents_effective_date_idx" ON "policy_documents" ("effective_date");
CREATE INDEX IF NOT EXISTS "privacy_acceptance_policy_doc_idx" ON "privacy_policy_acceptance" ("policy_document_id");
CREATE INDEX IF NOT EXISTS "privacy_acceptance_terms_doc_idx" ON "privacy_policy_acceptance" ("terms_document_id");
