/**
 * Automated policy document sync script
 *
 * Scans policies/ directory for markdown files and syncs them to database
 * Uses filename pattern: {type}-{version}.md (e.g., privacy-policy-1.0.0.md)
 * Only inserts new versions - never updates existing ones for legal integrity
 *
 * Usage:
 *   Staging:  npm run sync-policies:staging
 *   Production: npm run sync-policies:prod
 *   Local: npm run sync-policies (uses .env.local)
 *
 * Database Connection:
 *   Uses drizzle config files for proper connection strings
 *   Staging/Prod require Cloud SQL Proxy on port 54321
 */

import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { policyDocuments } from "../src/lib/db/schema"
import { eq, and } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import * as dotenv from "dotenv"

interface PolicyFile {
  filename: string
  type: "privacy_policy" | "terms_of_service"
  version: string
  content: string
  hash: string
}

/**
 * Parse policy filename to extract type and version
 * Expected format: privacy-policy-1.0.0.md or terms-of-service-1.0.0.md
 */
function parseFilename(filename: string): {
  type: "privacy_policy" | "terms_of_service"
  version: string
} | null {
  const match = filename.match(/^(privacy-policy|terms-of-service)-(.+)\.md$/)
  if (!match) return null

  const [, typeStr, version] = match
  const type =
    typeStr === "privacy-policy" ? "privacy_policy" : "terms_of_service"

  return { type, version }
}

/**
 * Extract effective date from markdown content
 * Looks for: **Effective Date:** January 2, 2025
 */
function extractEffectiveDate(content: string): Date {
  const match = content.match(
    /\*\*Effective Date:\*\*\s+([A-Za-z]+\s+\d+,\s+\d{4})/,
  )
  if (match) {
    return new Date(match[1])
  }
  // Default to now if not found
  return new Date()
}

/**
 * Calculate hash of content for change detection
 */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex")
}

/**
 * Load all policy files from policies/ directory
 */
function loadPolicyFiles(policiesDir: string): PolicyFile[] {
  if (!fs.existsSync(policiesDir)) {
    throw new Error(`Policies directory not found: ${policiesDir}`)
  }

  const files = fs.readdirSync(policiesDir)
  const policyFiles: PolicyFile[] = []

  for (const filename of files) {
    if (!filename.endsWith(".md")) continue

    const parsed = parseFilename(filename)
    if (!parsed) {
      console.warn(`⚠️  Skipping invalid filename: ${filename}`)
      continue
    }

    const filepath = path.join(policiesDir, filename)
    const content = fs.readFileSync(filepath, "utf8")
    const hash = hashContent(content)

    policyFiles.push({
      filename,
      type: parsed.type,
      version: parsed.version,
      content,
      hash,
    })
  }

  return policyFiles
}

/**
 * Get database connection based on environment
 * Supports: staging, production, or local (default)
 */
async function getDatabaseConnection() {
  const env = process.argv[2] || "local"

  let databaseUrl: string

  if (env === "staging") {
    // Read from drizzle-staging.config.ts
    const configPath = path.join(__dirname, "..", "drizzle-staging.config.ts")
    if (!fs.existsSync(configPath)) {
      console.error("❌ drizzle-staging.config.ts not found")
      process.exit(1)
    }

    // Import the config
    const config = await import(configPath)
    databaseUrl = config.default.dbCredentials.url

    if (!databaseUrl) {
      console.error("❌ No database URL found in drizzle-staging.config.ts")
      process.exit(1)
    }
  } else if (env === "production") {
    // Check for production config
    const configPath = path.join(
      __dirname,
      "..",
      "drizzle-production.config.ts",
    )
    if (!fs.existsSync(configPath)) {
      console.error("❌ drizzle-production.config.ts not found")
      console.error("   Create this file with production database credentials")
      process.exit(1)
    }

    // Import the config
    const config = await import(configPath)
    databaseUrl = config.default.dbCredentials.url

    if (!databaseUrl) {
      console.error("❌ No database URL found in drizzle-production.config.ts")
      process.exit(1)
    }
  } else {
    // Local development - load .env.local
    dotenv.config({ path: path.join(__dirname, "..", ".env.local") })
    databaseUrl =
      process.env.DATABASE_URL ||
      "postgresql://postgres:dev_password_change_in_prod@localhost:5432/keyfate_dev"
  }

  // Mask password in log output
  const urlForLog = databaseUrl.replace(/:[^:@]+@/, ":***@")
  console.log(`🔌 Connecting to ${env} database: ${urlForLog.split("@")[1]}`)

  const client = postgres(databaseUrl, {
    max: 1,
    onnotice: () => {}, // Suppress notices
  })

  return drizzle(client)
}

/**
 * Sync policy files to database
 */
async function syncPolicyDocuments() {
  try {
    const policiesDir = path.join(__dirname, "..", "policies")
    console.log(`📂 Scanning policies directory: ${policiesDir}`)

    const policyFiles = loadPolicyFiles(policiesDir)
    console.log(`📄 Found ${policyFiles.length} policy files\n`)

    if (policyFiles.length === 0) {
      console.log("⚠️  No policy files found. Create files like:")
      console.log("   - privacy-policy-1.0.0.md")
      console.log("   - terms-of-service-1.0.0.md")
      process.exit(1)
    }

    const db = await getDatabaseConnection()

    let inserted = 0
    let skipped = 0
    let warnings = 0

    for (const file of policyFiles) {
      // Check if this version already exists
      const existing = await db
        .select()
        .from(policyDocuments)
        .where(
          and(
            eq(policyDocuments.type, file.type),
            eq(policyDocuments.version, file.version),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        // Verify content hasn't changed
        const existingHash = hashContent(existing[0].content)
        if (existingHash !== file.hash) {
          console.error(`❌ ERROR: Content changed for existing version!`)
          console.error(`   File: ${file.filename}`)
          console.error(`   Type: ${file.type}`)
          console.error(`   Version: ${file.version}`)
          console.error(
            `   This is a CRITICAL error - you cannot modify existing policy versions!`,
          )
          console.error(
            `   Create a new version instead (e.g., ${file.type}-${incrementVersion(file.version)}.md)`,
          )
          warnings++
        } else {
          console.log(`✓ ${file.filename} - Already in database (unchanged)`)
          skipped++
        }
        continue
      }

      // Insert new version
      const effectiveDate = extractEffectiveDate(file.content)
      await db.insert(policyDocuments).values({
        type: file.type,
        version: file.version,
        content: file.content,
        effectiveDate,
      })

      console.log(
        `✅ ${file.filename} - Inserted (effective: ${effectiveDate.toISOString().split("T")[0]})`,
      )
      inserted++
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Inserted: ${inserted}`)
    console.log(`   ✓  Skipped: ${skipped}`)
    if (warnings > 0) {
      console.log(`   ❌ Warnings: ${warnings}`)
      console.log(
        `\n⚠️  CRITICAL: Policy content was modified! See errors above.`,
      )
      process.exit(1)
    }

    console.log(`\n✅ Policy documents synced successfully!`)
    process.exit(0)
  } catch (error) {
    console.error("❌ Error syncing policy documents:", error)
    process.exit(1)
  }
}

/**
 * Helper to suggest next version number
 */
function incrementVersion(version: string): string {
  const parts = version.split(".")
  if (parts.length === 3) {
    const [major, minor, patch] = parts.map(Number)
    return `${major}.${minor}.${patch + 1}`
  }
  return version + ".1"
}

syncPolicyDocuments()
