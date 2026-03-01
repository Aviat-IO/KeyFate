import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock getDatabase
const mockDb = {
  select: vi.fn(),
  update: vi.fn(),
}

// Chain helpers for select
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
}

// Chain helpers for update
const mockUpdateChain = {
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
}

mockDb.select.mockReturnValue(mockSelectChain)
mockDb.update.mockReturnValue(mockUpdateChain)

vi.mock("$lib/db/drizzle", () => ({
  getDatabase: vi.fn().mockResolvedValue(mockDb),
}))

// Mock getUTXOStatus
const mockGetUTXOStatus = vi.fn()
vi.mock("$lib/bitcoin/broadcast", () => ({
  getUTXOStatus: (...args: unknown[]) => mockGetUTXOStatus(...args),
}))

// Mock logger
vi.mock("$lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Helper to create a mock UTXO record
function makePendingUtxo(overrides: Record<string, unknown> = {}) {
  return {
    id: "utxo-1",
    secretId: "secret-1",
    txId: "abc123",
    outputIndex: 0,
    amountSats: 50000,
    timelockScript: "deadbeef",
    ownerPubkey: "aabb",
    recipientPubkey: "ccdd",
    ttlBlocks: 144,
    status: "pending",
    preSignedRecipientTx: null,
    confirmedAt: null,
    spentAt: null,
    spentByTxId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe("confirm-utxos cron logic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockSelectChain)
    mockDb.update.mockReturnValue(mockUpdateChain)
    mockSelectChain.from.mockReturnThis()
    mockSelectChain.where.mockReturnThis()
    mockSelectChain.limit.mockResolvedValue([])
    mockUpdateChain.set.mockReturnThis()
    mockUpdateChain.where.mockResolvedValue(undefined)
  })

  it("returns early when no pending UTXOs exist", async () => {
    mockSelectChain.limit.mockResolvedValue([])

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.success).toBe(true)
    expect(result.processed).toBe(0)
    expect(result.succeeded).toBe(0)
    expect(result.stillPending).toBe(0)
    expect(result.message).toBe("No pending UTXOs to check")
    expect(mockGetUTXOStatus).not.toHaveBeenCalled()
  })

  it("updates confirmed UTXOs to confirmed status", async () => {
    const utxo = makePendingUtxo()
    mockSelectChain.limit.mockResolvedValue([utxo])
    mockGetUTXOStatus.mockResolvedValue({
      confirmed: true,
      blockHeight: 800000,
      spent: false,
    })

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.success).toBe(true)
    expect(result.processed).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.stillPending).toBe(0)
    expect(result.failed).toBe(0)

    expect(mockGetUTXOStatus).toHaveBeenCalledWith("abc123", 0, "mainnet")
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockUpdateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
        confirmedAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    )
  })

  it("leaves unconfirmed UTXOs as pending", async () => {
    const utxo = makePendingUtxo()
    mockSelectChain.limit.mockResolvedValue([utxo])
    mockGetUTXOStatus.mockResolvedValue({
      confirmed: false,
      spent: false,
    })

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.success).toBe(true)
    expect(result.processed).toBe(1)
    expect(result.succeeded).toBe(0)
    expect(result.stillPending).toBe(1)
    expect(result.failed).toBe(0)

    // Should NOT have called update
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it("limits processing to max 10 UTXOs per run", async () => {
    const utxos = Array.from({ length: 10 }, (_, i) =>
      makePendingUtxo({ id: `utxo-${i}`, txId: `tx-${i}` }),
    )
    mockSelectChain.limit.mockResolvedValue(utxos)
    mockGetUTXOStatus.mockResolvedValue({
      confirmed: true,
      blockHeight: 800000,
      spent: false,
    })

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.processed).toBe(10)
    expect(result.succeeded).toBe(10)
    expect(mockGetUTXOStatus).toHaveBeenCalledTimes(10)

    // Verify the SQL limit was applied
    expect(mockSelectChain.limit).toHaveBeenCalledWith(10)
  })

  it("handles per-UTXO errors without crashing the batch", async () => {
    const utxo1 = makePendingUtxo({ id: "utxo-1", txId: "tx-1" })
    const utxo2 = makePendingUtxo({ id: "utxo-2", txId: "tx-2" })
    const utxo3 = makePendingUtxo({ id: "utxo-3", txId: "tx-3" })

    mockSelectChain.limit.mockResolvedValue([utxo1, utxo2, utxo3])

    // First succeeds (confirmed), second throws, third succeeds (still pending)
    mockGetUTXOStatus
      .mockResolvedValueOnce({ confirmed: true, blockHeight: 800000, spent: false })
      .mockRejectedValueOnce(new Error("mempool.space API timeout"))
      .mockResolvedValueOnce({ confirmed: false, spent: false })

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.success).toBe(true)
    expect(result.processed).toBe(3)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.stillPending).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors![0]).toContain("mempool.space API timeout")
  })

  it("handles multiple confirmed and pending UTXOs in a batch", async () => {
    const utxos = [
      makePendingUtxo({ id: "utxo-1", txId: "tx-1" }),
      makePendingUtxo({ id: "utxo-2", txId: "tx-2" }),
      makePendingUtxo({ id: "utxo-3", txId: "tx-3" }),
      makePendingUtxo({ id: "utxo-4", txId: "tx-4" }),
    ]
    mockSelectChain.limit.mockResolvedValue(utxos)

    mockGetUTXOStatus
      .mockResolvedValueOnce({ confirmed: true, blockHeight: 800001, spent: false })
      .mockResolvedValueOnce({ confirmed: false, spent: false })
      .mockResolvedValueOnce({ confirmed: true, blockHeight: 800002, spent: false })
      .mockResolvedValueOnce({ confirmed: false, spent: false })

    const { confirmPendingUtxos } = await import("$lib/cron/confirm-utxos")
    const result = await confirmPendingUtxos()

    expect(result.succeeded).toBe(2)
    expect(result.stillPending).toBe(2)
    expect(result.failed).toBe(0)
  })
})
