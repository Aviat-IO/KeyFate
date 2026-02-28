import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("node-cron", () => {
  const tasks: Array<{ stop: () => void }> = []
  return {
    default: {
      schedule: vi.fn((_schedule: string, _callback: () => void) => {
        const task = { stop: vi.fn() }
        tasks.push(task)
        return task
      }),
    },
    __tasks: tasks,
  }
})

describe("Cron Scheduler", () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv as NodeJS.ProcessEnv
  })

  it("should not start when CRON_ENABLED is false", async () => {
    process.env.CRON_ENABLED = "false"
    process.env.CRON_SECRET = "test-secret"

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    const { startScheduler } = await import("$lib/cron/scheduler")
    startScheduler()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("disabled"),
    )

    consoleSpy.mockRestore()
  })

  it("should not start when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET
    delete process.env.CRON_ENABLED

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { startScheduler } = await import("$lib/cron/scheduler")
    startScheduler()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("CRON_SECRET not set"),
    )

    consoleSpy.mockRestore()
  })

  it("should register all 7 cron jobs when enabled", async () => {
    process.env.CRON_SECRET = "test-secret-with-enough-length"
    delete process.env.CRON_ENABLED

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    const cron = await import("node-cron")
    const { startScheduler } = await import("$lib/cron/scheduler")
    startScheduler()

    expect(cron.default.schedule).toHaveBeenCalledTimes(7)

    const scheduleArgs = (cron.default.schedule as ReturnType<typeof vi.fn>).mock.calls
    const schedules = scheduleArgs.map((args: string[]) => args[0])

    expect(schedules.filter((s: string) => s === "*/15 * * * *")).toHaveLength(2)
    expect(schedules.filter((s: string) => s.startsWith("0 "))).toHaveLength(5)

    consoleSpy.mockRestore()
  })

  it("should stop all tasks when stopScheduler is called", async () => {
    process.env.CRON_SECRET = "test-secret-with-enough-length"
    delete process.env.CRON_ENABLED

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    const { startScheduler, stopScheduler } = await import(
      "$lib/cron/scheduler"
    )
    startScheduler()
    stopScheduler()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("stopped"),
    )

    consoleSpy.mockRestore()
  })
})
