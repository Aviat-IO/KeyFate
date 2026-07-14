import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
const mockDatabase = {
	select: vi.fn(() => ({ from: vi.fn(() => ({ where: mockSelectWhere })) })),
	delete: mockDelete
};
const mockDeleteExportFile = vi.fn();

vi.mock('$lib/db/get-database', () => ({
	getDatabase: vi.fn(async () => mockDatabase)
}));

vi.mock('$lib/gdpr/export-service', () => ({
	deleteExportFile: mockDeleteExportFile
}));

vi.mock('$lib/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn()
	}
}));

describe('runCleanupExports', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDeleteWhere.mockResolvedValue(undefined);
	});

	it('deletes a legacy filesystem artifact before deleting its row', async () => {
		mockSelectWhere.mockResolvedValue([
			{
				id: 'job-id',
				fileUrl: 'https://keyfate.test/api/user/export-data/download?user=user-id&file=123.json',
				artifactData: null
			}
		]);

		const { runCleanupExports } = await import('../cleanup-exports');
		const result = await runCleanupExports();

		expect(mockDeleteExportFile).toHaveBeenCalledWith(
			'https://keyfate.test/api/user/export-data/download?user=user-id&file=123.json'
		);
		expect(mockDelete).toHaveBeenCalledTimes(1);
		expect(mockDeleteExportFile.mock.invocationCallOrder[0]).toBeLessThan(
			mockDelete.mock.invocationCallOrder[0]!
		);
		expect(result).toMatchObject({ success: true, cleaned: 1, errors: 0 });
	});

	it('deletes row-backed artifacts without calling the legacy file helper', async () => {
		mockSelectWhere.mockResolvedValue([
			{
				id: 'job-id',
				fileUrl: null,
				artifactData: 'encoded-artifact'
			}
		]);

		const { runCleanupExports } = await import('../cleanup-exports');
		await runCleanupExports();

		expect(mockDeleteExportFile).not.toHaveBeenCalled();
		expect(mockDelete).toHaveBeenCalledTimes(1);
	});
});
