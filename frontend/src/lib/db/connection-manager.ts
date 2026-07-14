import postgres, { type Sql } from 'postgres';
import { parseDatabaseConnection } from './connection-policy';

interface DatabaseStats {
	connected: boolean;
	lastSuccessfulConnection: Date | null;
	connectionAttempts: number;
	circuitBreakerOpen: boolean;
	circuitBreakerResetTime: Date | null;
	isShuttingDown: boolean;
	activeQueries: number;
	totalConnections: number;
	totalErrors: number;
	uptime: number;
}

class ConnectionManager {
	private static instance: ConnectionManager | null = null;
	private connection: Sql | null = null;
	private initialization: Promise<Sql> | null = null;
	private lastSuccessfulConnection: Date | null = null;
	private isShuttingDown = false;
	private activeQueries = 0;
	private totalConnections = 0;
	private totalErrors = 0;

	static getInstance(): ConnectionManager {
		ConnectionManager.instance ??= new ConnectionManager();
		return ConnectionManager.instance;
	}

	async getConnection(connectionString: string): Promise<Sql> {
		if (this.isShuttingDown) throw new Error('Database is shutting down');
		if (this.connection) return this.connection;
		if (this.initialization) return this.initialization;

		this.initialization = this.initialize(connectionString);
		try {
			return await this.initialization;
		} finally {
			this.initialization = null;
		}
	}

	private async initialize(connectionString: string): Promise<Sql> {
		const parsed = parseDatabaseConnection(connectionString);
		const connection =
			parsed.transport === 'unix' ? postgres(parsed.options) : postgres(parsed.url, parsed.options);

		try {
			await connection`select 1`;
			this.connection = connection;
			this.lastSuccessfulConnection = new Date();
			this.totalConnections += 1;
			return connection;
		} catch (error) {
			this.totalErrors += 1;
			await connection.end({ timeout: 1 }).catch(() => undefined);
			throw error;
		}
	}

	async withReservedConnection<T>(operation: (connection: Sql) => Promise<T>): Promise<T> {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
		const pool = await this.getConnection(connectionString);
		const reserved = await pool.reserve();
		this.trackQueryStart();
		try {
			return await operation(reserved);
		} finally {
			this.trackQueryEnd();
			reserved.release();
		}
	}

	async healthCheck(statementTimeoutMs = 2_500): Promise<boolean> {
		try {
			if (!Number.isSafeInteger(statementTimeoutMs) || statementTimeoutMs <= 0) return false;
			const connectionString = process.env.DATABASE_URL;
			if (!connectionString) return false;
			const connection = await this.getConnection(connectionString);
			this.trackQueryStart();
			try {
				await connection.begin(async (transaction) => {
					await transaction`select set_config('statement_timeout', ${`${statementTimeoutMs}ms`}, true)`;
					await transaction`select 1`;
				});
				return true;
			} finally {
				this.trackQueryEnd();
			}
		} catch {
			this.totalErrors += 1;
			return false;
		}
	}

	async closeConnection(): Promise<void> {
		this.isShuttingDown = true;
		await this.initialization?.catch(() => undefined);
		if (this.connection) {
			await this.connection.end({ timeout: 5 });
			this.connection = null;
		}
		this.lastSuccessfulConnection = null;
	}

	beginStartup(): void {
		this.isShuttingDown = false;
	}

	getStats(): DatabaseStats {
		return {
			connected: this.connection !== null,
			lastSuccessfulConnection: this.lastSuccessfulConnection,
			connectionAttempts: this.initialization ? 1 : 0,
			circuitBreakerOpen: false,
			circuitBreakerResetTime: null,
			isShuttingDown: this.isShuttingDown,
			activeQueries: this.activeQueries,
			totalConnections: this.totalConnections,
			totalErrors: this.totalErrors,
			uptime: this.lastSuccessfulConnection
				? Date.now() - this.lastSuccessfulConnection.getTime()
				: 0
		};
	}

	trackQueryStart(): void {
		this.activeQueries += 1;
	}

	trackQueryEnd(): void {
		this.activeQueries = Math.max(0, this.activeQueries - 1);
	}

	reset(): void {
		this.connection = null;
		this.initialization = null;
		this.lastSuccessfulConnection = null;
		this.isShuttingDown = false;
		this.activeQueries = 0;
		this.totalConnections = 0;
		this.totalErrors = 0;
	}
}

export const connectionManager = ConnectionManager.getInstance();
