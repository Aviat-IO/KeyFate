import { NextResponse } from "next/server"
import { checkDatabaseConnection } from "@/lib/db/connection"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

async function checkEmailService(): Promise<boolean> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) return false

    const response = await fetch("https://api.sendgrid.com/v3/user/profile", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    return response.ok
  } catch (error) {
    logger.error("Email service health check failed", error as Error)
    return false
  }
}

function checkEncryptionKey(): boolean {
  try {
    const key = process.env.ENCRYPTION_KEY
    if (!key) return false

    const decoded = Buffer.from(key, "base64")
    return decoded.length === 32
  } catch (error) {
    return false
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const detailed = searchParams.get("detailed") === "true"

  try {
    const [dbConnected, emailHealthy] = await Promise.all([
      checkDatabaseConnection(),
      checkEmailService(),
    ])

    const encryptionKeyValid = checkEncryptionKey()

    const checks = {
      database: dbConnected ? "healthy" : "unhealthy",
      email: emailHealthy ? "healthy" : "unhealthy",
      encryption: encryptionKeyValid ? "healthy" : "unhealthy",
    }

    const allHealthy = dbConnected && emailHealthy && encryptionKeyValid
    const anyUnhealthy = !dbConnected || !emailHealthy || !encryptionKeyValid

    const health = {
      status: allHealthy ? "healthy" : anyUnhealthy ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      checks,
      ...(detailed && {
        environment: process.env.NODE_ENV || "unknown",
        region:
          process.env.VERCEL_REGION ||
          process.env.GOOGLE_CLOUD_REGION ||
          "unknown",
        version: {
          deploymentHash: process.env.DEPLOYMENT_HASH || "unknown",
          gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
        },
      }),
    }

    const statusCode = allHealthy ? 200 : anyUnhealthy ? 503 : 500

    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    logger.error("Health check failed", error as Error)

    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
