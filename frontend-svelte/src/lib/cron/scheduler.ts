import cron from "node-cron"
import crypto from "crypto"

interface CronJob {
  name: string
  schedule: string
  endpoint: string
}

const CRON_JOBS: CronJob[] = [
  {
    name: "check-secrets",
    schedule: "*/15 * * * *",
    endpoint: "/api/cron/check-secrets",
  },
  {
    name: "process-reminders",
    schedule: "*/15 * * * *",
    endpoint: "/api/cron/process-reminders",
  },
  {
    name: "process-exports",
    schedule: "0 2 * * *",
    endpoint: "/api/cron/process-exports",
  },
  {
    name: "process-deletions",
    schedule: "0 3 * * *",
    endpoint: "/api/cron/process-deletions",
  },
  {
    name: "process-subscription-downgrades",
    schedule: "0 4 * * *",
    endpoint: "/api/cron/process-subscription-downgrades",
  },
  {
    name: "cleanup-tokens",
    schedule: "0 5 * * *",
    endpoint: "/api/cron/cleanup-tokens",
  },
  {
    name: "cleanup-exports",
    schedule: "0 6 * * *",
    endpoint: "/api/cron/cleanup-exports",
  },
]

function generateHMACHeaders(
  endpoint: string,
  cronSecret: string,
): Record<string, string> {
  const timestamp = Date.now()
  const host = `127.0.0.1:${process.env.PORT || 3000}`
  const url = `http://${host}${endpoint}`
  const message = `${timestamp}.${url}`
  const signature = crypto
    .createHmac("sha256", cronSecret)
    .update(message)
    .digest("hex")

  return {
    "x-cron-signature": signature,
    "x-cron-timestamp": timestamp.toString(),
    "x-forwarded-proto": "http",
    host,
  }
}

async function invokeCronEndpoint(job: CronJob): Promise<void> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error(`[scheduler] CRON_SECRET not set, skipping ${job.name}`)
    return
  }

  const port = process.env.PORT || 3000
  const url = `http://127.0.0.1:${port}${job.endpoint}`

  try {
    const headers = generateHMACHeaders(job.endpoint, cronSecret)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      console.error(
        `[scheduler] ${job.name} failed: ${response.status} ${body}`,
      )
      return
    }

    const result = await response.json().catch(() => ({}))
    console.log(
      `[scheduler] ${job.name} completed: processed=${(result as any).processed ?? 0}, succeeded=${(result as any).succeeded ?? 0}, failed=${(result as any).failed ?? 0}`,
    )
  } catch (error) {
    console.error(
      `[scheduler] ${job.name} error:`,
      error instanceof Error ? error.message : String(error),
    )
  }
}

const scheduledTasks: cron.ScheduledTask[] = []

export function startScheduler(): void {
  const enabled = process.env.CRON_ENABLED !== "false"
  if (!enabled) {
    console.log("[scheduler] Cron scheduler disabled (CRON_ENABLED=false)")
    return
  }

  if (!process.env.CRON_SECRET) {
    console.warn("[scheduler] CRON_SECRET not set, scheduler will not start")
    return
  }

  console.log(`[scheduler] Starting cron scheduler with ${CRON_JOBS.length} jobs`)

  for (const job of CRON_JOBS) {
    const task = cron.schedule(job.schedule, () => {
      invokeCronEndpoint(job).catch((err) => {
        console.error(`[scheduler] Unhandled error in ${job.name}:`, err)
      })
    })
    scheduledTasks.push(task)
    console.log(`[scheduler] Registered: ${job.name} (${job.schedule})`)
  }
}

export function stopScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop()
  }
  scheduledTasks.length = 0
  console.log("[scheduler] All cron jobs stopped")
}
