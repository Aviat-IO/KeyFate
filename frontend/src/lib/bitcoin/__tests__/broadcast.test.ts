import { afterEach, describe, expect, it, vi } from 'vitest';
import { broadcastTransaction, getUTXOStatus } from '$lib/bitcoin/broadcast';

const originalFetch = globalThis.fetch;
const txId = 'ab'.repeat(32);
const otherTxId = 'cd'.repeat(32);

function setFetch(
	implementation: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
) {
	globalThis.fetch = vi.fn(implementation) as unknown as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('bounded Bitcoin broadcast binding', () => {
	it('accepts only the locally computed transaction ID', async () => {
		setFetch(async () => new Response(txId, { status: 200 }));

		await expect(broadcastTransaction('deadbeef', 'signet', txId)).resolves.toBe(txId);
	});

	it('rejects a different returned ID when the expected transaction is not known', async () => {
		setFetch(async (_input, init) =>
			init?.method === 'POST'
				? new Response(otherTxId, { status: 200 })
				: new Response('not found', { status: 404 })
		);

		await expect(broadcastTransaction('deadbeef', 'signet', txId)).rejects.toThrow(
			'Failed to broadcast'
		);
	});

	it('treats accepted-then-error as success only when the local ID is queryable', async () => {
		setFetch(async (_input, init) =>
			init?.method === 'POST'
				? new Response('gateway timeout', { status: 504 })
				: new Response(JSON.stringify({ txid: txId }), { status: 200 })
		);

		await expect(broadcastTransaction('deadbeef', 'signet', txId)).resolves.toBe(txId);
	});
});

describe('exact persisted outpoint verification', () => {
	it('returns status only after the output amount and script match', async () => {
		setFetch(async (input) =>
			String(input).includes('/outspend/')
				? new Response(JSON.stringify({ spent: false }))
				: new Response(
						JSON.stringify({
							status: { confirmed: true, block_height: 100 },
							vout: [{ value: 20_000, scriptpubkey: '0014' + '11'.repeat(20) }]
						})
					)
		);

		await expect(
			getUTXOStatus(txId, 0, 'signet', {
				amountSats: 20_000,
				scriptPubKey: '0014' + '11'.repeat(20)
			})
		).resolves.toEqual({ confirmed: true, blockHeight: 100, spent: false });
	});

	it('rejects an explorer output with a mismatched amount or script', async () => {
		setFetch(
			async () =>
				new Response(
					JSON.stringify({
						status: { confirmed: true },
						vout: [{ value: 19_999, scriptpubkey: '0014' + '22'.repeat(20) }]
					})
				)
		);

		await expect(
			getUTXOStatus(txId, 0, 'signet', {
				amountSats: 20_000,
				scriptPubKey: '0014' + '11'.repeat(20)
			})
		).rejects.toThrow('does not match');
	});
});
