import { beforeEach, describe, expect, it, vi } from 'vitest';

const returning = vi.fn();
const where = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const update = vi.fn(() => ({ set }));
const db = { update };

vi.mock('$lib/db/schema', () => ({
	disclosureLog: {
		id: 'disclosure.id',
		leaseId: 'disclosure.lease_id'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left, right })),
	and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions }))
}));

import { updateDisclosureLog } from '../disclosure-helpers';

describe('updateDisclosureLog lease fencing', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('updates only the row owned by the supplied lease', async () => {
		returning.mockResolvedValue([{ id: 'log-1' }]);

		const updated = await updateDisclosureLog(db as never, 'log-1', 'lease-current', 'sent');

		expect(updated).toBe(true);
		expect(where).toHaveBeenCalledWith({
			type: 'and',
			conditions: [
				{ type: 'eq', left: 'disclosure.id', right: 'log-1' },
				{ type: 'eq', left: 'disclosure.lease_id', right: 'lease-current' }
			]
		});
	});

	it('reports a stale lease when the fenced update returns no row', async () => {
		returning.mockResolvedValue([]);

		await expect(
			updateDisclosureLog(db as never, 'log-1', 'lease-stale', 'failed', 'provider failed')
		).resolves.toBe(false);
	});
});
