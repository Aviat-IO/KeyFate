/**
 * Tests for POST /api/secrets/[id]/check-in
 *
 * Verifies CSRF protection, auth, user verification, transaction-based
 * check-in with SELECT FOR UPDATE, recovery from "failed" status,
 * check-in history recording, reminder scheduling, and response shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Isolated check-in dependency boundary ---

const mockRequireCSRFProtection = vi.fn();
const mockCreateCSRFErrorResponse = vi.fn();
const mockEnsureUserExists = vi.fn();
const mockTransaction = vi.fn();
const mockDb = { transaction: mockTransaction };
const mockMapDrizzleSecretToApiShape = vi.fn();
const mockGetSecretWithRecipients = vi.fn();
const mockLogCheckIn = vi.fn();
const mockScheduleRemindersForSecret = vi.fn();

vi.mock('$lib/server/check-in-dependencies', () => ({
	checkInDependencies: {
		and: (...args: unknown[]) => ({ op: 'and', args }),
		checkinHistory: {
			secretId: 'checkin_history.secret_id',
			userId: 'checkin_history.user_id',
			checkedInAt: 'checkin_history.checked_in_at',
			nextCheckIn: 'checkin_history.next_check_in'
		},
		createCSRFErrorResponse: (...args: unknown[]) => mockCreateCSRFErrorResponse(...args),
		ensureUserExists: (...args: unknown[]) => mockEnsureUserExists(...args),
		eq: (left: unknown, right: unknown) => ({ op: 'eq', left, right }),
		getDatabase: vi.fn(async () => mockDb),
		getSecretWithRecipients: (...args: unknown[]) => mockGetSecretWithRecipients(...args),
		logCheckIn: (...args: unknown[]) => mockLogCheckIn(...args),
		logger: { error: vi.fn() },
		mapDrizzleSecretToApiShape: (...args: unknown[]) => mockMapDrizzleSecretToApiShape(...args),
		requireCSRFProtection: (...args: unknown[]) => mockRequireCSRFProtection(...args),
		scheduleRemindersForSecret: (...args: unknown[]) => mockScheduleRemindersForSecret(...args),
		secrets: {
			id: 'secrets.id',
			userId: 'secrets.user_id'
		}
	}
}));

// --- Constants ---

const TEST_USER_ID = 'user-123';
const TEST_SECRET_ID = '550e8400-e29b-41d4-a716-446655440000';

// --- Helpers ---

function createEvent(secretId = TEST_SECRET_ID) {
	return {
		params: { id: secretId },
		locals: {
			auth: vi.fn().mockResolvedValue({
				user: { id: TEST_USER_ID }
			})
		},
		request: new Request(`http://localhost/api/secrets/${secretId}/check-in`, { method: 'POST' })
	} as any;
}

/** Build a mock secret row as returned by the DB select */
function makeSecretRow(overrides: Record<string, unknown> = {}) {
	return {
		id: TEST_SECRET_ID,
		userId: TEST_USER_ID,
		title: 'Test Secret',
		checkInDays: 30,
		status: 'active',
		bitcoinDeliveryStatus: null,
		triggeredAt: null,
		processingLeaseId: null,
		processingLeaseExpiresAt: null,
		retryCount: 0,
		lastRetryAt: null,
		lastError: null,
		lastCheckIn: null,
		nextCheckIn: null,
		createdAt: new Date('2025-01-01'),
		updatedAt: new Date('2025-01-01'),
		...overrides
	};
}

/** Build a mapped API-shape secret for the response */
function makeMappedSecret(overrides: Record<string, unknown> = {}) {
	return {
		id: TEST_SECRET_ID,
		user_id: TEST_USER_ID,
		title: 'Test Secret',
		check_in_days: 30,
		status: 'active',
		next_check_in: new Date().toISOString(),
		last_check_in: new Date().toISOString(),
		recipients: [],
		...overrides
	};
}

/**
 * Creates a mock transaction callback executor.
 *
 * The endpoint calls `database.transaction(async (tx) => { ... })`.
 * We mock `transaction` to invoke the callback with a mock `tx` object
 * that supports the chained query builder patterns used in the endpoint.
 *
 * @param selectResult - Row(s) returned by `tx.select().from().where().for()`
 * @param updateResult - Row(s) returned by `tx.update().set().where().returning()`
 */
function setupTransaction(selectResult: unknown[] | null, updateResult?: unknown[]) {
	const insertValues = vi.fn().mockResolvedValue(undefined);
	const mockInsert = vi.fn(() => ({ values: insertValues }));

	const mockTx = {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					for: vi.fn().mockResolvedValue(selectResult ?? [])
				}))
			}))
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue(updateResult ?? selectResult ?? [])
				}))
			}))
		})),
		insert: mockInsert
	};

	mockTransaction.mockImplementation(async (cb: (tx: typeof mockTx) => Promise<unknown>) => {
		return cb(mockTx);
	});

	return { mockTx, insertValues };
}

// --- Tests ---

describe('POST /api/secrets/[id]/check-in', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Defaults: CSRF passes, user exists
		mockRequireCSRFProtection.mockResolvedValue({ valid: true });
		mockCreateCSRFErrorResponse.mockReturnValue(
			new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
				status: 403
			})
		);
		mockEnsureUserExists.mockResolvedValue({ exists: true, created: false });
		mockLogCheckIn.mockResolvedValue(undefined);
		mockScheduleRemindersForSecret.mockResolvedValue(undefined);
	});

	// ---------------------------------------------------------------
	// 1. CSRF validation
	// ---------------------------------------------------------------
	describe('CSRF protection', () => {
		it('returns 403 if CSRF validation fails', async () => {
			mockRequireCSRFProtection.mockResolvedValue({ valid: false });

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(403);
			const data = await response.json();
			expect(data.error).toBe('CSRF validation failed');
			expect(mockCreateCSRFErrorResponse).toHaveBeenCalledTimes(1);
		});
	});

	// ---------------------------------------------------------------
	// 2. Auth session
	// ---------------------------------------------------------------
	describe('Authentication', () => {
		it('returns 401 if no session', async () => {
			const event = createEvent();
			event.locals.auth.mockResolvedValue(null);

			const { POST } = await import('../+server');
			const response = await POST(event);

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.error).toBe('Unauthorized');
		});

		it('returns 401 if session has no user id', async () => {
			const event = createEvent();
			event.locals.auth.mockResolvedValue({ user: {} });

			const { POST } = await import('../+server');
			const response = await POST(event);

			expect(response.status).toBe(401);
		});
	});

	// ---------------------------------------------------------------
	// 3. User verification
	// ---------------------------------------------------------------
	describe('User verification', () => {
		it('returns 500 if ensureUserExists throws', async () => {
			mockEnsureUserExists.mockRejectedValue(new Error('DB connection lost'));

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(500);
			const data = await response.json();
			expect(data.error).toBe('Failed to verify user account');
		});
	});

	// ---------------------------------------------------------------
	// 4. Secret not found
	// ---------------------------------------------------------------
	describe('Secret lookup', () => {
		it('returns 404 if secret not found in transaction', async () => {
			setupTransaction([]);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data.error).toBe('Secret not found');
		});
	});

	// ---------------------------------------------------------------
	// 5. Concurrency and Bitcoin lifecycle guards
	// ---------------------------------------------------------------
	describe('Check-in lifecycle guards', () => {
		it('rejects check-in while a disclosure lease is live', async () => {
			setupTransaction([
				makeSecretRow({
					processingLeaseId: '550e8400-e29b-41d4-a716-446655440001',
					processingLeaseExpiresAt: new Date(Date.now() + 60_000)
				})
			]);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({ error: 'Secret disclosure is already in progress' });
		});

		it('requires an atomic Bitcoin generation refresh instead of ordinary check-in', async () => {
			setupTransaction([makeSecretRow({ bitcoinDeliveryStatus: 'ready' })]);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({
				error: 'Refresh the Bitcoin continuity generation to complete this check-in'
			});
		});
	});

	// ---------------------------------------------------------------
	// 6. Normal check-in (active secret)
	// ---------------------------------------------------------------
	describe('Normal check-in (active secret)', () => {
		it('successfully checks in an active secret', async () => {
			const secretRow = makeSecretRow({ status: 'active' });
			const updatedRow = makeSecretRow({
				status: 'active',
				lastCheckIn: new Date(),
				nextCheckIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			});
			const { mockTx } = setupTransaction([secretRow], [updatedRow]);

			const mapped = makeMappedSecret();
			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(mapped);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.secret).toBeDefined();
			expect(data.next_check_in).toBe(mapped.next_check_in);
		});

		it('clears stale processing and failure state for an active secret', async () => {
			const secretRow = makeSecretRow({ status: 'active' });
			const updatedRow = makeSecretRow({ status: 'active' });

			// Capture the set() call to inspect the update payload
			let capturedPayload: Record<string, unknown> | undefined;
			const mockReturning = vi.fn().mockResolvedValue([updatedRow]);
			const mockWhere = vi.fn(() => ({ returning: mockReturning }));
			const mockSet = vi.fn((payload: Record<string, unknown>) => {
				capturedPayload = payload;
				return { where: mockWhere };
			});

			const insertValues = vi.fn().mockResolvedValue(undefined);

			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							for: vi.fn().mockResolvedValue([secretRow])
						}))
					}))
				})),
				update: vi.fn(() => ({ set: mockSet })),
				insert: vi.fn(() => ({ values: insertValues }))
			};

			mockTransaction.mockImplementation(async (cb: Function) => cb(mockTx));

			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const { POST } = await import('../+server');
			await POST(createEvent());

			expect(capturedPayload).toBeDefined();
			expect(capturedPayload!.lastCheckIn).toBeInstanceOf(Date);
			expect(capturedPayload!.nextCheckIn).toBeInstanceOf(Date);
			expect(capturedPayload!.updatedAt).toBeInstanceOf(Date);
			expect(capturedPayload).toMatchObject({
				status: 'active',
				processingStartedAt: null,
				processingLeaseId: null,
				processingLeaseExpiresAt: null,
				triggeredAt: null,
				retryCount: 0,
				lastRetryAt: null,
				lastError: null
			});
		});
	});

	// ---------------------------------------------------------------
	// 7. Recovery check-in (failed secret)
	// ---------------------------------------------------------------
	describe('Recovery check-in (failed secret)', () => {
		it('resets status to active, retryCount to 0, lastRetryAt and lastError to null', async () => {
			const failedSecret = makeSecretRow({
				status: 'failed',
				retryCount: 5,
				lastRetryAt: new Date('2025-06-01'),
				lastError: 'Delivery timeout after 3 attempts'
			});

			const recoveredSecret = makeSecretRow({
				status: 'active',
				retryCount: 0,
				lastRetryAt: null,
				lastError: null
			});

			// Capture the set() payload to verify recovery fields
			let capturedPayload: Record<string, unknown> | undefined;
			const mockReturning = vi.fn().mockResolvedValue([recoveredSecret]);
			const mockWhere = vi.fn(() => ({ returning: mockReturning }));
			const mockSet = vi.fn((payload: Record<string, unknown>) => {
				capturedPayload = payload;
				return { where: mockWhere };
			});

			const insertValues = vi.fn().mockResolvedValue(undefined);

			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							for: vi.fn().mockResolvedValue([failedSecret])
						}))
					}))
				})),
				update: vi.fn(() => ({ set: mockSet })),
				insert: vi.fn(() => ({ values: insertValues }))
			};

			mockTransaction.mockImplementation(async (cb: Function) => cb(mockTx));

			const mapped = makeMappedSecret({ status: 'active' });
			mockGetSecretWithRecipients.mockResolvedValue({ ...recoveredSecret, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(mapped);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(200);

			// Verify the update payload includes recovery fields
			expect(capturedPayload).toBeDefined();
			expect(capturedPayload!.status).toBe('active');
			expect(capturedPayload!.retryCount).toBe(0);
			expect(capturedPayload!.lastRetryAt).toBeNull();
			expect(capturedPayload!.lastError).toBeNull();

			// Also verify standard check-in fields are present
			expect(capturedPayload!.lastCheckIn).toBeInstanceOf(Date);
			expect(capturedPayload!.nextCheckIn).toBeInstanceOf(Date);
			expect(capturedPayload!.updatedAt).toBeInstanceOf(Date);
		});

		it('returns success with mapped secret after recovery', async () => {
			const failedSecret = makeSecretRow({
				status: 'failed',
				retryCount: 3,
				lastRetryAt: new Date('2025-05-15'),
				lastError: 'Relay unreachable'
			});
			const recoveredSecret = makeSecretRow({
				status: 'active',
				retryCount: 0,
				lastRetryAt: null,
				lastError: null
			});

			setupTransaction([failedSecret], [recoveredSecret]);

			const mapped = makeMappedSecret({ status: 'active' });
			mockGetSecretWithRecipients.mockResolvedValue({ ...recoveredSecret, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(mapped);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.secret.status).toBe('active');
		});
	});

	// ---------------------------------------------------------------
	// 7. Check-in history recording
	// ---------------------------------------------------------------
	describe('Check-in history', () => {
		it('inserts check-in history for normal check-in', async () => {
			const secretRow = makeSecretRow({ status: 'active', checkInDays: 7 });
			const updatedRow = makeSecretRow({ status: 'active' });

			const insertValues = vi.fn().mockResolvedValue(undefined);
			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							for: vi.fn().mockResolvedValue([secretRow])
						}))
					}))
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn().mockResolvedValue([updatedRow])
						}))
					}))
				})),
				insert: vi.fn(() => ({ values: insertValues }))
			};

			mockTransaction.mockImplementation(async (cb: Function) => cb(mockTx));

			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const { POST } = await import('../+server');
			await POST(createEvent());

			expect(mockTx.insert).toHaveBeenCalledTimes(1);
			expect(insertValues).toHaveBeenCalledTimes(1);

			const historyValues = insertValues.mock.calls[0][0];
			expect(historyValues.secretId).toBe(TEST_SECRET_ID);
			expect(historyValues.userId).toBe(TEST_USER_ID);
			expect(historyValues.checkedInAt).toBeInstanceOf(Date);
			expect(historyValues.nextCheckIn).toBeInstanceOf(Date);
		});

		it('inserts check-in history for recovery check-in', async () => {
			const failedSecret = makeSecretRow({
				status: 'failed',
				checkInDays: 14,
				retryCount: 2,
				lastError: 'timeout'
			});
			const recoveredSecret = makeSecretRow({ status: 'active' });

			const insertValues = vi.fn().mockResolvedValue(undefined);
			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							for: vi.fn().mockResolvedValue([failedSecret])
						}))
					}))
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn().mockResolvedValue([recoveredSecret])
						}))
					}))
				})),
				insert: vi.fn(() => ({ values: insertValues }))
			};

			mockTransaction.mockImplementation(async (cb: Function) => cb(mockTx));

			mockGetSecretWithRecipients.mockResolvedValue({ ...recoveredSecret, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const { POST } = await import('../+server');
			await POST(createEvent());

			expect(insertValues).toHaveBeenCalledTimes(1);
			const historyValues = insertValues.mock.calls[0][0];
			expect(historyValues.secretId).toBe(TEST_SECRET_ID);
			expect(historyValues.userId).toBe(TEST_USER_ID);
		});

		it('computes nextCheckIn based on checkInDays', async () => {
			const checkInDays = 7;
			const secretRow = makeSecretRow({ status: 'active', checkInDays });
			const updatedRow = makeSecretRow({ status: 'active' });

			const insertValues = vi.fn().mockResolvedValue(undefined);
			const mockTx = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							for: vi.fn().mockResolvedValue([secretRow])
						}))
					}))
				})),
				update: vi.fn(() => ({
					set: vi.fn(() => ({
						where: vi.fn(() => ({
							returning: vi.fn().mockResolvedValue([updatedRow])
						}))
					}))
				})),
				insert: vi.fn(() => ({ values: insertValues }))
			};

			mockTransaction.mockImplementation(async (cb: Function) => cb(mockTx));

			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const before = Date.now();
			const { POST } = await import('../+server');
			await POST(createEvent());
			const after = Date.now();

			const historyValues = insertValues.mock.calls[0][0];
			const nextCheckInMs = historyValues.nextCheckIn.getTime();
			const expectedMin = before + checkInDays * 24 * 60 * 60 * 1000;
			const expectedMax = after + checkInDays * 24 * 60 * 60 * 1000;

			expect(nextCheckInMs).toBeGreaterThanOrEqual(expectedMin);
			expect(nextCheckInMs).toBeLessThanOrEqual(expectedMax);
		});
	});

	// ---------------------------------------------------------------
	// 8. Side effects: audit log + reminder scheduling
	// ---------------------------------------------------------------
	describe('Side effects', () => {
		it('calls logCheckIn after successful check-in', async () => {
			const secretRow = makeSecretRow({ status: 'active', checkInDays: 30 });
			const updatedRow = makeSecretRow({ status: 'active' });
			setupTransaction([secretRow], [updatedRow]);

			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const { POST } = await import('../+server');
			const event = createEvent();
			await POST(event);

			expect(mockLogCheckIn).toHaveBeenCalledTimes(1);
			expect(mockLogCheckIn).toHaveBeenCalledWith(
				TEST_USER_ID,
				TEST_SECRET_ID,
				expect.objectContaining({
					nextCheckIn: expect.any(String),
					checkInDays: 30
				}),
				event
			);
		});

		it('calls scheduleRemindersForSecret after successful check-in', async () => {
			const secretRow = makeSecretRow({ status: 'active', checkInDays: 14 });
			const updatedRow = makeSecretRow({ status: 'active' });
			setupTransaction([secretRow], [updatedRow]);

			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(makeMappedSecret());

			const { POST } = await import('../+server');
			await POST(createEvent());

			expect(mockScheduleRemindersForSecret).toHaveBeenCalledTimes(1);
			expect(mockScheduleRemindersForSecret).toHaveBeenCalledWith(
				TEST_SECRET_ID,
				expect.any(Date),
				14
			);
		});

		it('does not call side effects when secret not found', async () => {
			setupTransaction([]);

			const { POST } = await import('../+server');
			await POST(createEvent());

			expect(mockLogCheckIn).not.toHaveBeenCalled();
			expect(mockScheduleRemindersForSecret).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------
	// 9. Response shape
	// ---------------------------------------------------------------
	describe('Response shape', () => {
		it('returns { success, secret, next_check_in } on success', async () => {
			const secretRow = makeSecretRow({ status: 'active' });
			const updatedRow = makeSecretRow({ status: 'active' });
			setupTransaction([secretRow], [updatedRow]);

			const mapped = makeMappedSecret({ next_check_in: '2026-04-07T00:00:00.000Z' });
			mockGetSecretWithRecipients.mockResolvedValue({ ...updatedRow, recipients: [] });
			mockMapDrizzleSecretToApiShape.mockReturnValue(mapped);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toEqual({
				success: true,
				secret: mapped,
				next_check_in: '2026-04-07T00:00:00.000Z'
			});
		});

		it('returns 404 if getSecretWithRecipients returns null after update', async () => {
			const secretRow = makeSecretRow({ status: 'active' });
			const updatedRow = makeSecretRow({ status: 'active' });
			setupTransaction([secretRow], [updatedRow]);

			mockGetSecretWithRecipients.mockResolvedValue(null);

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data.error).toBe('Secret not found after update');
		});
	});

	// ---------------------------------------------------------------
	// 10. General error handling
	// ---------------------------------------------------------------
	describe('Error handling', () => {
		it('returns 500 on unexpected transaction error', async () => {
			mockTransaction.mockRejectedValue(new Error('Connection reset'));

			const { POST } = await import('../+server');
			const response = await POST(createEvent());

			expect(response.status).toBe(500);
			const data = await response.json();
			expect(data.error).toBe('Internal server error');
		});
	});
});
