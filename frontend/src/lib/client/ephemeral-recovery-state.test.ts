import { describe, expect, it } from 'vitest';
import { partitionRecoveryShares } from './ephemeral-recovery-state';

describe('partitionRecoveryShares', () => {
	it('assigns one distinct generated share to each recipient', () => {
		const result = partitionRecoveryShares(['share-1', 'share-2', 'share-3'], 2);

		expect(result.recipientShares).toEqual(['share-1', 'share-2']);
		expect(new Set(result.recipientShares).size).toBe(2);
		expect(result.backupShares).toEqual(['share-3']);
	});

	it('does not classify assigned recipient shares as owner backups', () => {
		const result = partitionRecoveryShares(['share-1', 'share-2'], 2);

		expect(result.backupShares).toEqual([]);
	});

	it('fails closed when there are more recipients than generated shares', () => {
		expect(() => partitionRecoveryShares(['share-1'], 2)).toThrow(
			'Recipient share count does not match'
		);
	});

	it('fails closed rather than assigning one share to multiple recipients', () => {
		expect(() => partitionRecoveryShares(['share-1', 'share-1'], 2)).toThrow(
			'Each recipient must be assigned a distinct recovery share'
		);
	});
});
