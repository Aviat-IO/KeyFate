import { describe, expect, it } from 'vitest';
import { createExportArtifact, decodeExportArtifact, MAX_EXPORT_BYTES } from '../export-artifact';

describe('durable export artifact', () => {
	it('round-trips compressed JSON with size and digest verification', async () => {
		const artifact = await createExportArtifact({ user: { id: 'user-1' }, values: [1, 2, 3] });
		const decoded = await decodeExportArtifact(
			artifact.encodedData,
			artifact.fileSize,
			artifact.sha256
		);

		expect(JSON.parse(Buffer.from(decoded).toString('utf8'))).toEqual({
			user: { id: 'user-1' },
			values: [1, 2, 3]
		});
		expect(artifact.storedSize).toBeLessThan(artifact.fileSize + 100);
	});

	it('rejects an integrity mismatch', async () => {
		const artifact = await createExportArtifact({ value: 'original' });
		await expect(
			decodeExportArtifact(artifact.encodedData, artifact.fileSize, '0'.repeat(64))
		).rejects.toThrow('Export artifact integrity check failed');
	});

	it('rejects artifacts above the bounded database size', async () => {
		await expect(createExportArtifact({ value: 'x'.repeat(MAX_EXPORT_BYTES) })).rejects.toThrow(
			'Export exceeds'
		);
	});
});
