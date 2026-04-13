import crypto from 'crypto';

export function generateHexToken(byteLength = 32): string {
	const array = new Uint8Array(byteLength);

	try {
		globalThis.crypto.getRandomValues(array);

		if (!array.some((byte) => byte !== 0)) {
			return crypto.randomBytes(byteLength).toString('hex');
		}
	} catch {
		return crypto.randomBytes(byteLength).toString('hex');
	}

	return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hashToken(token: string): string {
	return crypto.createHash('sha256').update(token).digest('hex');
}
