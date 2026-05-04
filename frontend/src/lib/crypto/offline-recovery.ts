import sss from 'shamirs-secret-sharing';

export interface OfflineRecoveryResult {
	secret: string;
	sharesUsed: string[];
}

const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const SHARE_FIELD_NAMES = [
	'share',
	'serverShare',
	'server_share',
	'disclosedShare',
	'disclosed_share',
	'recipientShare',
	'recipient_share'
] as const;

/**
 * Extract a KeyFate Shamir share from either raw hex or a small JSON recovery kit.
 * All parsing is local-only and has no network or storage side effects.
 */
export function parseOfflineShare(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new Error('Share is required');
	}

	if (trimmed.startsWith('{')) {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(trimmed) as Record<string, unknown>;
		} catch {
			throw new Error('JSON share import is not valid JSON');
		}

		for (const field of SHARE_FIELD_NAMES) {
			const value = parsed[field];
			if (typeof value === 'string' && value.trim()) {
				return normalizeShareHex(value);
			}
		}

		throw new Error(
			`JSON share import must contain one of: ${SHARE_FIELD_NAMES.join(', ')}`
		);
	}

	return normalizeShareHex(trimmed);
}

export function normalizeShareHex(share: string): string {
	const compact = share.trim().replace(/\s+/g, '');
	if (!compact) {
		throw new Error('Share is required');
	}
	if (!HEX_PATTERN.test(compact)) {
		throw new Error('Share must be hexadecimal text');
	}
	return compact.length % 2 === 0 ? compact : `0${compact}`;
}

/**
 * Reconstruct a KeyFate secret from a recipient share and disclosed server share.
 */
export function recoverOfflineSecret(
	recipientShareInput: string,
	disclosedShareInput: string
): OfflineRecoveryResult {
	const sharesUsed = [parseOfflineShare(recipientShareInput), parseOfflineShare(disclosedShareInput)];
	const shareBuffers = sharesUsed.map((share) => sss.Buffer.from(share, 'hex'));
	const firstLength = shareBuffers[0]?.length;
	if (!firstLength || !shareBuffers.every((share) => share.length === firstLength)) {
		throw new Error('Shares are not the same length. Check that both shares were copied fully.');
	}

	const recovered = sss.combine(shareBuffers).toString();
	if (!recovered) {
		throw new Error('Recovered secret was empty');
	}

	return { secret: recovered, sharesUsed };
}
