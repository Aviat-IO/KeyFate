const rawBaseUrl = process.env.PLAYWRIGHT_EXTERNAL_BASE_URL?.trim();
if (!rawBaseUrl) {
	console.error('PLAYWRIGHT_EXTERNAL_BASE_URL is required for staging tests.');
	process.exit(2);
}

let baseUrl: URL;
try {
	baseUrl = new URL(rawBaseUrl);
} catch {
	console.error('PLAYWRIGHT_EXTERNAL_BASE_URL must be a valid URL.');
	process.exit(2);
}

if (
	baseUrl.protocol !== 'https:' ||
	baseUrl.username ||
	baseUrl.password ||
	baseUrl.port ||
	baseUrl.pathname !== '/' ||
	baseUrl.search ||
	baseUrl.hash
) {
	console.error(
		'Staging tests require a root HTTPS origin without credentials, port, query, or fragment.'
	);
	process.exit(2);
}

const APPROVED_STAGING_HOSTS = new Set([
	'staging.keyfate.com',
	'dead-mans-switch-staging.up.railway.app'
]);
if (!APPROVED_STAGING_HOSTS.has(baseUrl.hostname)) {
	console.error('The staging test target is not an approved KeyFate staging host.');
	process.exit(2);
}

const separator = Bun.argv.indexOf('--');
const forwardedArgs = separator >= 0 ? Bun.argv.slice(separator + 1) : Bun.argv.slice(2);
const child = Bun.spawn(['bunx', 'playwright', 'test', 'tests/staging', ...forwardedArgs], {
	stdin: 'inherit',
	stdout: 'inherit',
	stderr: 'inherit',
	env: process.env
});

process.exit(await child.exited);
