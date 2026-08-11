import {
	validateRecoveryShareEnvelopeContext,
	type RecoveryShareEnvelope
} from '$lib/crypto/recovery-v3';

interface ServerShareBoundaryInput {
	serverShare: string;
	threshold: number;
	total: number;
}

export type ServerShareBoundary = { mode: 'authenticated-v3'; envelopeIndex: 1 };

/** Enforce the creation-time one-service-share boundary for every newly created secret. */
export function validateServerShareBoundary(input: ServerShareBoundaryInput): ServerShareBoundary {
	if (input.threshold !== 2) {
		throw new Error('Authenticated recovery currently requires a threshold of 2');
	}

	let parsed: RecoveryShareEnvelope;
	try {
		parsed = validateRecoveryShareEnvelopeContext(input.serverShare, {
			index: 1,
			threshold: input.threshold,
			total: input.total
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : '';
		if (message.includes('ciphertext digest')) throw error;
		if (message.includes('threshold and total')) {
			throw new Error('Server share must match the request threshold and total', { cause: error });
		}
		if (message.includes('expected recovery share index')) {
			throw new Error('Server share must be the authenticated v3 envelope at actual index 1', {
				cause: error
			});
		}
		if (message.includes('embedded Shamir')) {
			throw new Error('Server share must be the authenticated v3 envelope at actual index 1', {
				cause: error
			});
		}
		throw new Error('Server share must be a strict authenticated v3 envelope', { cause: error });
	}

	if (parsed.threshold !== input.threshold || parsed.total !== input.total) {
		throw new Error('Server share must match the request threshold and total');
	}
	return { mode: 'authenticated-v3', envelopeIndex: 1 };
}
