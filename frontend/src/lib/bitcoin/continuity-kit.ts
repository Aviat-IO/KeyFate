import { z } from 'zod';
import {
	decryptRecoveryKit,
	encryptRecoveryKit,
	type EncryptedRecoveryKit
} from '$lib/crypto/recovery-kit';

const hex32 = z.string().regex(/^[0-9a-f]{64}$/);

const continuitySchema = z
	.object({
		format: z.literal('keyfate-bitcoin-continuity'),
		version: z.literal(1),
		secretId: z.string().uuid(),
		network: z.enum(['mainnet', 'testnet']),
		generation: z.number().int().positive(),
		ownerPrivateKeyHex: hex32,
		symmetricKeyHex: hex32,
		nostrEventId: hex32,
		recipientAddress: z.string().min(14).max(128),
		ttlBlocks: z.number().int().positive(),
		currentUtxo: z
			.object({
				txId: hex32,
				outputIndex: z.number().int().nonnegative(),
				amountSats: z.number().int().positive()
			})
			.strict(),
		currentTimelockScriptHex: z.string().regex(/^[0-9a-f]+$/)
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
	return continuitySchema.parse(await decryptRecoveryKit(envelope, passphrase));
}
