export interface ShutdownLogger {
	info(message: string, context?: Record<string, unknown>): void;
	error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

export interface ShutdownControllerOptions {
	cleanup: () => Promise<void>;
	exit: (code: number) => void;
	logger: ShutdownLogger;
	timeoutMs?: number;
}

export interface ShutdownController {
	shutdown(reason: string, exitCode: number): Promise<void>;
}

export function createShutdownController({
	cleanup,
	exit,
	logger,
	timeoutMs = 10_000
}: ShutdownControllerOptions): ShutdownController {
	let activeShutdown: Promise<void> | null = null;

	return {
		shutdown(reason: string, exitCode: number): Promise<void> {
			if (activeShutdown) return activeShutdown;

			activeShutdown = new Promise<void>((resolve) => {
				let exited = false;
				const finish = () => {
					if (exited) return;
					exited = true;
					exit(exitCode);
					resolve();
				};
				const timeout = setTimeout(() => {
					logger.error('Application shutdown timed out', undefined, { reason, timeoutMs });
					finish();
				}, timeoutMs);
				timeout.unref?.();

				logger.info('Application shutdown started', { reason, exitCode });
				void cleanup()
					.then(() => logger.info('Application shutdown completed', { reason, exitCode }))
					.catch((error: unknown) =>
						logger.error(
							'Application shutdown cleanup failed',
							error instanceof Error ? error : undefined,
							{ reason, exitCode }
						)
					)
					.finally(() => {
						clearTimeout(timeout);
						finish();
					});
			});

			return activeShutdown;
		}
	};
}
