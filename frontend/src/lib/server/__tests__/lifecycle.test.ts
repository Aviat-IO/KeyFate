import { describe, expect, it, vi } from 'vitest';
import { createShutdownController } from '$lib/server/lifecycle';

function logger() {
	return {
		info: vi.fn(),
		error: vi.fn()
	};
}

describe('shutdown lifecycle', () => {
	it('drains cleanup before exiting and coalesces repeated shutdown requests', async () => {
		const events: string[] = [];
		const cleanup = vi.fn(async () => {
			events.push('cleanup');
		});
		const exit = vi.fn((code: number) => events.push(`exit:${code}`));
		const controller = createShutdownController({ cleanup, exit, logger: logger() });

		const first = controller.shutdown('SIGTERM', 0);
		const second = controller.shutdown('SIGINT', 0);
		await Promise.all([first, second]);

		expect(cleanup).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledOnce();
		expect(events).toEqual(['cleanup', 'exit:0']);
	});

	it('exits with the requested failure code when cleanup rejects', async () => {
		const failure = new Error('database close failed');
		const log = logger();
		const exit = vi.fn();
		const controller = createShutdownController({
			cleanup: vi.fn(async () => {
				throw failure;
			}),
			exit,
			logger: log
		});

		await controller.shutdown('uncaughtException', 1);

		expect(exit).toHaveBeenCalledWith(1);
		expect(log.error).toHaveBeenCalledWith(
			'Application shutdown cleanup failed',
			failure,
			expect.objectContaining({ reason: 'uncaughtException', exitCode: 1 })
		);
	});

	it('uses the bounded timeout when cleanup never settles', async () => {
		const exit = vi.fn();
		const log = logger();
		const controller = createShutdownController({
			cleanup: () => new Promise(() => undefined),
			exit,
			logger: log,
			timeoutMs: 5
		});

		await controller.shutdown('SIGTERM', 0);

		expect(exit).toHaveBeenCalledWith(0);
		expect(log.error).toHaveBeenCalledWith(
			'Application shutdown timed out',
			undefined,
			expect.objectContaining({ reason: 'SIGTERM', timeoutMs: 5 })
		);
	});
});
