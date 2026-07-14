import { z } from 'zod';
import {
	decryptRecoveryKit,
	encryptRecoveryKit,
	type EncryptedRecoveryKit
} from '$lib/crypto/recovery-kit';
import { bitcoinNetworkSchema } from './network.js';

const hex32 = z.string().regex(/^[0-9a-f]{64}$/);
const signedEventSchema = z
	.object({
		id: hex32,
		pubkey: hex32,
		created_at: z.number().int().nonnegative(),
		kind: z.number().int().nonnegative(),
		tags: z.array(z.array(z.string())),
		content: z.string(),
		sig: z.string().regex(/^[0-9a-f]{128}$/)
	})
	.strict();

const legacyContinuitySchema = z.object({
	format: z.literal('keyfate-bitcoin-continuity'),
	version: z.literal(1)
});

const continuitySchema = z
	.object({
		format: z.literal('keyfate-bitcoin-continuity'),
		version: z.literal(2),
		secretId: z.string().uuid(),
		network: bitcoinNetworkSchema,
		generation: z.number().int().positive(),
		ownerPrivateKeyHex: hex32,
		symmetricKeyHex: hex32,
		nostrCapsuleEventId: hex32,
		nostrManifestEvent: signedEventSchema,
		nostrCapsuleEvent: signedEventSchema,
		recipientId: z.string().uuid(),
		recipientNostrPubkey: hex32,
		recipientAddress: z.string().min(14).max(128),
		ttlBlocks: z.number().int().min(1).max(65535),
		currentUtxo: z
			.object({
				txId: hex32,
				outputIndex: z.number().int().nonnegative(),
				amountSats: z.number().int().positive()
			})
			.strict(),
		currentTimelockScriptHex: z.string().regex(/^(?:[0-9a-f]{2})+$/)
	})
	.strict();

export type BitcoinContinuityData = z.infer<typeof continuitySchema>;

export async function encryptBitcoinContinuityKit(
	data: BitcoinContinuityData,
	passphrase: string
): Promise<EncryptedRecoveryKit> {
	return encryptRecoveryKit(continuitySchema.parse(data), passphrase);
}

export async function decryptBitcoinContinuityKit(
	envelope: EncryptedRecoveryKit,
	passphrase: string
): Promise<BitcoinContinuityData> {
	const decrypted: unknown = await decryptRecoveryKit(envelope, passphrase);
	if (legacyContinuitySchema.safeParse(decrypted).success) {
		throw new Error(
			'Bitcoin continuity kit version 1 cannot refresh; re-enroll to create a version 2 kit'
		);
	}
	return continuitySchema.parse(decrypted);
}
