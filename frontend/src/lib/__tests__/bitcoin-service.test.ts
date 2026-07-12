import { describe, expect, it } from 'vitest';
import { buildBitcoinStatus } from '$lib/services/bitcoin-service';
import type { BitcoinUtxo } from '$lib/db/schema';

const BASE_UTXO: BitcoinUtxo = {
	id: '11111111-1111-4111-8111-111111111111',
	secretId: '22222222-2222-4222-8222-222222222222',
	txId: '11'.repeat(32),
	outputIndex: 0,
	amountSats: 50_000,
	timelockScript: 'aabb',
	ownerPubkey: `02${'22'.repeat(32)}`,
	recipientPubkey: `03${'33'.repeat(32)}`,
	ttlBlocks: 4_320,
	status: 'confirmed',
	preSignedRecipientTx: null,
	encryptedRecoveryTx: 'opaque',
	recoverySenderPubkey: '22'.repeat(32),
	recipientAddress: 'tb1qrecipient',
	network: 'testnet',
	generation: 2,
	generationKey: 'secret:2',
	recoveryManifest: { recipientId: 'recipient-1' },
	confirmedAt: new Date('2026-01-01T00:00:00Z'),
	spentAt: null,
	spentByTxId: null,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z')
};

describe('bitcoin-service read-only status projection', () => {
	it('returns disabled without a persisted generation', () => {
		expect(buildBitcoinStatus()).toEqual({
			enabled: false,
			utxo: null,
			estimatedDaysRemaining: null,
			refreshesRemaining: null,
			hasPreSignedTx: false,
			network: null
		});
	});

	it('reports public lifecycle metadata and encrypted-envelope availability', () => {
		const result = buildBitcoinStatus(BASE_UTXO);
		expect(result.enabled).toBe(true);
		expect(result.hasPreSignedTx).toBe(true);
		expect(result.utxo?.generation).toBe(2);
		expect(result.network).toBe('testnet');
		expect(result).not.toHaveProperty('preSignedRecipientTx');
	});

	it('fails closed on an unrecognized legacy network value', () => {
		expect(buildBitcoinStatus({ ...BASE_UTXO, network: null }).network).toBeNull();
	});
});
