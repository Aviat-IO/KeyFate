import { base64 } from '@scure/base';
import {
	decryptWithDerivedKey,
	deriveKeyFromPassphrase,
	encryptWithDerivedKey
} from './passphrase';

export interface EncryptedRecoveryKit {
	format: 'keyfate-owner-recovery-kit';
	version: 1;
	kdf: { name: 'PBKDF2-SHA256'; iterations: 600000; salt: string };
	cipher: { name: 'AES-256-GCM'; nonce: string; ciphertext: string };
}

export async function encryptRecoveryKit(
	data: unknown,
	passphrase: string
): Promise<EncryptedRecoveryKit> {
	if (passphrase.length < 12)
		throw new Error('Recovery-kit passphrase must be at least 12 characters');
	const plaintext = new TextEncoder().encode(JSON.stringify(data));
	const { key, salt } = await deriveKeyFromPassphrase(passphrase);
	const encrypted = await encryptWithDerivedKey(plaintext, key);
	plaintext.fill(0);

	return {
		format: 'keyfate-owner-recovery-kit',
		version: 1,
		kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: base64.encode(salt) },
		cipher: {
			name: 'AES-256-GCM',
			nonce: base64.encode(encrypted.nonce),
			ciphertext: base64.encode(encrypted.ciphertext)
		}
	};
}

export async function decryptRecoveryKit(
	envelope: EncryptedRecoveryKit,
	passphrase: string
): Promise<unknown> {
	if (
		envelope.format !== 'keyfate-owner-recovery-kit' ||
		envelope.version !== 1 ||
		envelope.kdf.name !== 'PBKDF2-SHA256' ||
		envelope.kdf.iterations !== 600000 ||
		envelope.cipher.name !== 'AES-256-GCM'
	) {
		throw new Error('Unsupported recovery-kit format');
	}
	const { key } = await deriveKeyFromPassphrase(passphrase, base64.decode(envelope.kdf.salt));
	const plaintext = await decryptWithDerivedKey(
		base64.decode(envelope.cipher.ciphertext),
		base64.decode(envelope.cipher.nonce),
		key
	);
	try {
		return JSON.parse(new TextDecoder().decode(plaintext));
	} finally {
		plaintext.fill(0);
	}
}
