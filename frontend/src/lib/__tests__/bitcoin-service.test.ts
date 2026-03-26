import { describe, it, expect, vi, beforeEach } from "vitest"
import { hex } from "@scure/base"

// --- Mocks ---

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockTransaction = vi.fn()

const mockDb = {
	select: mockSelect,
	insert: mockInsert,
	update: mockUpdate,
	transaction: mockTransaction,
}

vi.mock("$lib/db/drizzle", () => ({
	getDatabase: vi.fn().mockResolvedValue(mockDb),
}))

vi.mock("$lib/db/schema", () => ({
	bitcoinUtxos: { secretId: "secretId", status: "status", id: "id", createdAt: "createdAt" },
	secrets: { id: "id", userId: "userId" },
}))

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((_col, val) => `eq(${val})`),
	and: vi.fn((...args) => `and(${args.join(",")})`),
	desc: vi.fn((col) => `desc(${col})`),
}))

const mockCreateTimelockUTXO = vi.fn()
const mockCreatePreSignedRecipientTx = vi.fn()
vi.mock("$lib/bitcoin/transaction", () => ({
	createTimelockUTXO: (...args: unknown[]) => mockCreateTimelockUTXO(...args),
	createPreSignedRecipientTx: (...args: unknown[]) => mockCreatePreSignedRecipientTx(...args),
}))

const mockRefreshTimelockUTXO = vi.fn()
const mockEstimateRefreshesRemaining = vi.fn()
vi.mock("$lib/bitcoin/refresh", () => ({
	refreshTimelockUTXO: (...args: unknown[]) => mockRefreshTimelockUTXO(...args),
	estimateRefreshesRemaining: (...args: unknown[]) => mockEstimateRefreshesRemaining(...args),
}))

const mockBroadcastTransaction = vi.fn()
vi.mock("$lib/bitcoin/broadcast", () => ({
	broadcastTransaction: (...args: unknown[]) => mockBroadcastTransaction(...args),
	getUTXOStatus: vi.fn(),
}))

vi.mock("$lib/bitcoin/script", () => ({
	daysToBlocks: vi.fn((days: number) => days * 144),
	blocksToApproxDays: vi.fn((blocks: number) => blocks / 144),
}))

// --- Import under test ---

import { enableBitcoin, refreshBitcoin, getBitcoinStatus, getActiveUtxo } from "$lib/services/bitcoin-service"

// --- Fixtures ---

const SECRET_ID = "secret_123"
const USER_ID = "user_456"

const MOCK_SECRET = { id: SECRET_ID, userId: USER_ID, checkInDays: 30 }

const OWNER_PRIVKEY = new Uint8Array(32).fill(1)
const OWNER_PUBKEY = new Uint8Array(33).fill(2)
const RECIPIENT_PUBKEY = new Uint8Array(33).fill(3)
const RECIPIENT_PRIVKEY = new Uint8Array(32).fill(4)
const SYMMETRIC_KEY = new Uint8Array(32).fill(5)
const NOSTR_EVENT_ID = "a".repeat(64)
const TIMELOCK_SCRIPT = new Uint8Array(64).fill(6)

const MOCK_UTXO_RESULT = {
	txHex: "0200000001...",
	txId: "abc123",
	outputIndex: 0,
	timelockScript: TIMELOCK_SCRIPT,
}

const MOCK_PRESIGNED_RESULT = { txHex: "0200000002..." }

const MOCK_DB_UTXO = {
	id: "utxo_1",
	secretId: SECRET_ID,
	txId: "abc123",
	outputIndex: 0,
	amountSats: 50000,
	timelockScript: hex.encode(TIMELOCK_SCRIPT),
	ownerPubkey: hex.encode(OWNER_PUBKEY),
	recipientPubkey: hex.encode(RECIPIENT_PUBKEY),
	ttlBlocks: 4320,
	status: "confirmed",
	preSignedRecipientTx: "0200000002...",
	confirmedAt: new Date("2026-03-01"),
	createdAt: new Date("2026-03-01"),
}

// --- Helpers ---

function setupChainedQuery(results: unknown[]) {
	mockSelect.mockReturnValue({ from: mockFrom })
	mockFrom.mockReturnValue({ where: mockWhere })
	mockWhere.mockReturnValue({ orderBy: mockOrderBy })
	// For queries without orderBy, resolve directly
	mockWhere.mockResolvedValue(results)
	mockOrderBy.mockResolvedValue(results)
}

function setupInsert(returning: unknown[]) {
	mockInsert.mockReturnValue({ values: mockValues })
	mockValues.mockReturnValue({ returning: mockReturning })
	mockReturning.mockResolvedValue(returning)
}

// --- Tests ---

describe("bitcoin-service", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockBroadcastTransaction.mockResolvedValue("broadcast_txid_123")
	})

	describe("enableBitcoin", () => {
		const enableParams = {
			ownerPrivkey: OWNER_PRIVKEY,
			ownerPubkey: OWNER_PUBKEY,
			recipientPubkey: RECIPIENT_PUBKEY,
			fundingUtxo: { txId: "funding_tx", outputIndex: 0, amountSats: 100000, scriptPubKey: "00ab" },
			amountSats: 50000,
			feeRateSatsPerVbyte: 10,
			symmetricKeyK: SYMMETRIC_KEY,
			nostrEventId: NOSTR_EVENT_ID,
			recipientAddress: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
			recipientPrivkey: RECIPIENT_PRIVKEY,
			network: "testnet" as const,
		}

		it("throws when secret not found", async () => {
			// First query (secret lookup) returns empty
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockResolvedValue([])

			await expect(enableBitcoin(SECRET_ID, USER_ID, enableParams)).rejects.toThrow("Secret not found")
		})

		it("throws when Bitcoin already enabled", async () => {
			// First call: secret found; second call: existing UTXO found
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return Promise.resolve([MOCK_DB_UTXO])
			})

			await expect(enableBitcoin(SECRET_ID, USER_ID, enableParams)).rejects.toThrow(
				"Bitcoin is already enabled for this secret",
			)
		})

		it("creates timelock UTXO, broadcasts, creates pre-signed tx, and stores in DB", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return Promise.resolve([]) // no existing UTXO
			})

			mockCreateTimelockUTXO.mockReturnValue(MOCK_UTXO_RESULT)
			mockCreatePreSignedRecipientTx.mockReturnValue(MOCK_PRESIGNED_RESULT)
			setupInsert([{ id: "utxo_new", ...MOCK_DB_UTXO }])

			const result = await enableBitcoin(SECRET_ID, USER_ID, enableParams)

			expect(mockCreateTimelockUTXO).toHaveBeenCalledOnce()
			expect(mockBroadcastTransaction).toHaveBeenCalledWith(MOCK_UTXO_RESULT.txHex, "testnet")
			expect(mockCreatePreSignedRecipientTx).toHaveBeenCalledOnce()
			expect(mockInsert).toHaveBeenCalledOnce()
			expect(result.txId).toBe("broadcast_txid_123")
			expect(result.preSignedRecipientTx).toBe(MOCK_PRESIGNED_RESULT.txHex)
		})

		it("converts checkInDays to blocks for TTL", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return Promise.resolve([])
			})

			mockCreateTimelockUTXO.mockReturnValue(MOCK_UTXO_RESULT)
			mockCreatePreSignedRecipientTx.mockReturnValue(MOCK_PRESIGNED_RESULT)
			setupInsert([{ id: "utxo_new", ...MOCK_DB_UTXO }])

			const result = await enableBitcoin(SECRET_ID, USER_ID, enableParams)

			// 30 days * 144 blocks/day = 4320
			expect(result.ttlBlocks).toBe(4320)
		})
	})

	describe("refreshBitcoin", () => {
		const refreshParams = {
			ownerPrivkey: OWNER_PRIVKEY,
			recipientPrivkey: RECIPIENT_PRIVKEY,
			recipientAddress: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
			symmetricKeyK: SYMMETRIC_KEY,
			nostrEventId: NOSTR_EVENT_ID,
			feeRateSatsPerVbyte: 10,
			network: "testnet" as const,
		}

		it("throws when secret not found", async () => {
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockResolvedValue([])

			await expect(refreshBitcoin(SECRET_ID, USER_ID, refreshParams)).rejects.toThrow("Secret not found")
		})

		it("throws when no active UTXO exists", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return { orderBy: vi.fn().mockResolvedValue([]) }
			})

			await expect(refreshBitcoin(SECRET_ID, USER_ID, refreshParams)).rejects.toThrow(
				"No active Bitcoin UTXO found",
			)
		})

		it("spends current UTXO, broadcasts, creates new pre-signed tx, and stores atomically", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return { orderBy: vi.fn().mockResolvedValue([MOCK_DB_UTXO]) }
			})

			const newTimelockScript = new Uint8Array(64).fill(7)
			mockRefreshTimelockUTXO.mockReturnValue({
				txHex: "0200000003...",
				newTxId: "new_tx_id",
				newOutputIndex: 0,
				newTimelockScript,
			})
			mockCreatePreSignedRecipientTx.mockReturnValue({ txHex: "0200000004..." })
			mockEstimateRefreshesRemaining.mockReturnValue(15)

			// Mock transaction - execute the callback with a mock tx object
			mockTransaction.mockImplementation(async (cb: Function) => {
				const txMock = {
					update: vi.fn().mockReturnValue({
						set: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue([]),
						}),
					}),
					insert: vi.fn().mockReturnValue({
						values: vi.fn().mockReturnValue({
							returning: vi.fn().mockResolvedValue([{ id: "utxo_new", txId: "broadcast_txid_123" }]),
						}),
					}),
				}
				return cb(txMock)
			})

			const result = await refreshBitcoin(SECRET_ID, USER_ID, refreshParams)

			expect(mockRefreshTimelockUTXO).toHaveBeenCalledOnce()
			expect(mockBroadcastTransaction).toHaveBeenCalledOnce()
			expect(mockCreatePreSignedRecipientTx).toHaveBeenCalledOnce()
			expect(mockTransaction).toHaveBeenCalledOnce()
			expect(result.refreshesRemaining).toBe(15)
		})
	})

	describe("getBitcoinStatus", () => {
		it("throws when secret not found", async () => {
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockResolvedValue([])

			await expect(getBitcoinStatus(SECRET_ID, USER_ID)).rejects.toThrow("Secret not found")
		})

		it("returns disabled status when no UTXO exists", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return { orderBy: vi.fn().mockResolvedValue([]) }
			})

			const status = await getBitcoinStatus(SECRET_ID, USER_ID)

			expect(status.enabled).toBe(false)
			expect(status.utxo).toBeNull()
			expect(status.estimatedDaysRemaining).toBeNull()
			expect(status.refreshesRemaining).toBeNull()
			expect(status.hasPreSignedTx).toBe(false)
			expect(status.network).toBeNull()
		})

		it("returns enabled status with confirmed UTXO", async () => {
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return { orderBy: vi.fn().mockResolvedValue([MOCK_DB_UTXO]) }
			})

			const status = await getBitcoinStatus(SECRET_ID, USER_ID)

			expect(status.enabled).toBe(true)
			expect(status.utxo).not.toBeNull()
			expect(status.utxo!.txId).toBe("abc123")
			expect(status.utxo!.amountSats).toBe(50000)
			expect(status.hasPreSignedTx).toBe(true)
			expect(status.estimatedDaysRemaining).toBe(30) // 4320 / 144
		})

		it("returns null estimates for spent UTXO", async () => {
			const spentUtxo = { ...MOCK_DB_UTXO, status: "spent" }
			let callCount = 0
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockImplementation(() => {
				callCount++
				if (callCount === 1) return Promise.resolve([MOCK_SECRET])
				return { orderBy: vi.fn().mockResolvedValue([spentUtxo]) }
			})

			const status = await getBitcoinStatus(SECRET_ID, USER_ID)

			expect(status.enabled).toBe(true)
			expect(status.estimatedDaysRemaining).toBeNull()
			expect(status.refreshesRemaining).toBeNull()
		})
	})

	describe("getActiveUtxo", () => {
		it("returns null when no confirmed UTXO exists", async () => {
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockReturnValue({ orderBy: mockOrderBy })
			mockOrderBy.mockResolvedValue([])

			const result = await getActiveUtxo(SECRET_ID)
			expect(result).toBeNull()
		})

		it("returns the confirmed UTXO when it exists", async () => {
			mockSelect.mockReturnValue({ from: mockFrom })
			mockFrom.mockReturnValue({ where: mockWhere })
			mockWhere.mockReturnValue({ orderBy: mockOrderBy })
			mockOrderBy.mockResolvedValue([MOCK_DB_UTXO])

			const result = await getActiveUtxo(SECRET_ID)
			expect(result).toEqual(MOCK_DB_UTXO)
		})
	})
})
