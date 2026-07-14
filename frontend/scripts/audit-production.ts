import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface AuditAdvisory {
	id: number;
	url: string;
	title: string;
	severity: 'low' | 'moderate' | 'high' | 'critical';
}

type AuditReport = Record<string, AuditAdvisory[]>;

/**
 * Bun 1.3 reports a small number of lockfile-only build-tool advisories for
 * `bun audit --production`. An advisory may be allowlisted only when its
 * package is proven absent from a fresh production-only install made from the
 * same package.json and lockfile. Any new advisory or runtime path fails.
 */
const ALLOWED_LOCKFILE_ONLY_ADVISORIES = new Map<string, ReadonlySet<number>>([
	['yaml', new Set([1115555])],
	['esbuild', new Set([1102341, 1120680])]
]);

function collectInstalledPackageNames(nodeModulesPath: string): Set<string> {
	const packageNames = new Set<string>();
	if (!existsSync(nodeModulesPath)) return packageNames;

	for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
		if (entry.name.startsWith('@')) {
			for (const scopedEntry of readdirSync(join(nodeModulesPath, entry.name), {
				withFileTypes: true
			})) {
				if (scopedEntry.isDirectory()) {
					collectPackage(join(nodeModulesPath, entry.name, scopedEntry.name), packageNames);
				}
			}
		} else {
			collectPackage(join(nodeModulesPath, entry.name), packageNames);
		}
	}
	return packageNames;
}

function collectPackage(packagePath: string, packageNames: Set<string>): void {
	const manifestPath = join(packagePath, 'package.json');
	if (existsSync(manifestPath)) {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: unknown };
		if (typeof manifest.name === 'string') packageNames.add(manifest.name);
	}
	collectInstalledPackageNames(join(packagePath, 'node_modules')).forEach((name) =>
		packageNames.add(name)
	);
}

async function installProductionTree(): Promise<Set<string>> {
	const directory = mkdtempSync(join(tmpdir(), 'keyfate-production-audit-'));
	try {
		copyFileSync(new URL('../package.json', import.meta.url), join(directory, 'package.json'));
		copyFileSync(new URL('../bun.lock', import.meta.url), join(directory, 'bun.lock'));
		const install = Bun.spawn(
			['bun', 'install', '--frozen-lockfile', '--production', '--omit', 'peer', '--ignore-scripts'],
			{ cwd: directory, stdout: 'pipe', stderr: 'pipe' }
		);
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(install.stdout).text(),
			new Response(install.stderr).text(),
			install.exited
		]);
		if (exitCode !== 0) {
			throw new Error(
				`Unable to construct the production dependency tree: ${stderr.trim() || stdout.trim()}`
			);
		}
		return collectInstalledPackageNames(join(directory, 'node_modules'));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

const [productionPackages, auditResult] = await Promise.all([
	installProductionTree(),
	(async () => {
		const processHandle = Bun.spawn(['bun', 'audit', '--production', '--json'], {
			stdout: 'pipe',
			stderr: 'pipe'
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(processHandle.stdout).text(),
			new Response(processHandle.stderr).text(),
			processHandle.exited
		]);
		return { stdout, stderr, exitCode };
	})()
]);

let report: AuditReport;
try {
	report = JSON.parse(auditResult.stdout) as AuditReport;
} catch {
	console.error('Unable to parse Bun production audit output.');
	if (auditResult.stderr.trim()) console.error(auditResult.stderr.trim());
	process.exit(1);
}

const blocked: Array<{ packageName: string; advisory: AuditAdvisory; reason?: string }> = [];
const allowed: Array<{ packageName: string; advisory: AuditAdvisory }> = [];

for (const [packageName, advisories] of Object.entries(report)) {
	for (const advisory of advisories) {
		if (ALLOWED_LOCKFILE_ONLY_ADVISORIES.get(packageName)?.has(advisory.id)) {
			if (productionPackages.has(packageName)) {
				blocked.push({
					packageName,
					advisory,
					reason: 'allowlisted package is present in the production-only dependency tree'
				});
			} else {
				allowed.push({ packageName, advisory });
			}
		} else {
			blocked.push({ packageName, advisory });
		}
	}
}

for (const { packageName, advisory } of allowed) {
	console.warn(
		`Allowed lockfile-only advisory ${advisory.id} (${advisory.severity}) for absent production package ${packageName}: ${advisory.url}`
	);
}

if (blocked.length > 0) {
	for (const { packageName, advisory, reason } of blocked) {
		console.error(
			`Blocked production advisory ${advisory.id} (${advisory.severity}) for ${packageName}: ${advisory.title} ${advisory.url}${reason ? `; ${reason}` : ''}`
		);
	}
	process.exit(1);
}

if (auditResult.exitCode !== 0 && Object.keys(report).length === 0) {
	console.error(
		auditResult.stderr.trim() || 'Bun audit failed without a structured advisory report.'
	);
	process.exit(1);
}

console.log(
	`Production dependency audit passed: no advisory reaches the production-only install; ${allowed.length} exact lockfile-only advisories documented.`
);
