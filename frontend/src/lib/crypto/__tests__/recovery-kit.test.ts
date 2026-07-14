import { describe, expect, it } from 'vitest';
import { decryptRecoveryKit, encryptRecoveryKit } from '../recovery-kit';

describe('encrypted owner recovery kit', () => {
	it('round-trips authenticated recovery material', async () => {
		const data = { secretId: 'secret-1', shares: ['80aabb', '81ccdd'] };
		const envelope = await encryptRecoveryKit(data, 'correct horse battery staple');
		expect(JSON.stringify(envelope)).not.toContain('80aabb');
		await expect(decryptRecoveryKit(envelope, 'correct horse battery staple')).resolves.toEqual(
			data
		);
	});

	it('rejects the wrong passphrase', async () => {
		const envelope = await encryptRecoveryKit(
			{ shares: ['80aabb'] },
			'correct horse battery staple'
		);
		await expect(decryptRecoveryKit(envelope, 'incorrect passphrase')).rejects.toThrow();
	});

	it('requires a non-trivial passphrase', async () => {
		await expect(encryptRecoveryKit({}, 'too-short')).rejects.toThrow('at least 12 characters');
	});
});
