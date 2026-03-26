import cron from "node-cron"

interface CronJob {
  name: string
  schedule: string
  handler: () => Promise<{ processed: number; succeeded: number; failed: number }>
}

const runningJobs = new Set<string>()

/**
 * Lazily builds the cron job list. Handler functions are imported at call time
 * to avoid top-level module resolution (which breaks test mocking in Bun).
 */
function getCronJobs(): CronJob[] {
  return [
    {
      name: "check-secrets",
      schedule: "*/15 * * * *",
      handler: async () => {
        const { runCheckSecrets } = await import("./check-secrets")
        return runCheckSecrets()
      },
    },
    {
      name: "process-reminders",
      schedule: "*/15 * * * *",
      handler: async () => {
        const { runProcessReminders } = await import("./process-reminders")
        return runProcessReminders()
      },
    },
    {
      name: "process-exports",
      schedule: "0 2 * * *",
      handler: async () => {
        const { runProcessExports } = await import("./process-exports")
        return runProcessExports()
      },
    },
    {
      name: "process-deletions",
      schedule: "0 3 * * *",
      handler: async () => {
        const { runProcessDeletions } = await import("./process-deletions")
        return runProcessDeletions()
      },
    },
    {
      name: "process-subscription-downgrades",
      schedule: "0 4 * * *",
      handler: async () => {
        const { runProcessSubscriptionDowngrades } = await import("./process-subscription-downgrades")
        return runProcessSubscriptionDowngrades()
      },
    },
    {
      name: "cleanup-tokens",
      schedule: "0 5 * * *",
      handler: async () => {
        const { runCleanupTokens } = await import("./cleanup-tokens")
        return runCleanupTokens()
      },
    },
    {
      name: "confirm-utxos",
      schedule: "*/10 * * * *",
      handler: async () => {
        const { confirmPendingUtxos } = await import("./confirm-utxos")
        return confirmPendingUtxos()
      },
    },
    {
      name: "cleanup-exports",
      schedule: "0 6 * * *",
      handler: async () => {
        const { runCleanupExports } = await import("./cleanup-exports")
        return runCleanupExports()
      },
    },
  ]
}

async function invokeCronJob(job: CronJob): Promise<void> {
  if (runningJobs.has(job.name)) {
    console.warn(
      `[scheduler] ${job.name} is still running, skipping this invocation`,
    )
    return
  }

  runningJobs.add(job.name)
  try {
    const result = await job.handler()
    console.log(
      `[scheduler] ${job.name} completed: processed=${result.processed ?? 0}, succeeded=${result.succeeded ?? 0}, failed=${result.failed ?? 0}`,
    )
  } catch (error) {
    console.error(
      `[scheduler] ${job.name} error:`,
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    runningJobs.delete(job.name)
  }
}

const scheduledTasks: ReturnType<typeof cron.schedule>[] = []

export function startScheduler(): void {
  const enabled = process.env.CRON_ENABLED !== "false"
  if (!enabled) {
    console.log("[scheduler] Cron scheduler disabled (CRON_ENABLED=false)")
    return
  }

  const jobs = getCronJobs()

  console.log(
    `[scheduler] Starting cron scheduler with ${jobs.length} jobs`,
  )

  for (const job of jobs) {
    const task = cron.schedule(job.schedule, () => {
      invokeCronJob(job).catch((err) => {
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
