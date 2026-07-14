export function isBitcoinEnrollmentEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
	const railwayEnvironment = environment.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase();
	return (
		environment.BITCOIN_ENROLLMENT_ENABLED === 'true' &&
		environment.BITCOIN_NETWORK === 'signet' &&
		railwayEnvironment === 'staging'
	);
}
