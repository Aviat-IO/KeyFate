import { getPublicKey } from 'nostr-tools/pure';
import { getConversationKey, decrypt, encrypt } from '$lib/nostr/encryption';
import { z } from 'zod';
import { bitcoinNetworkSchema } from './network.js';

const hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const boundedHex = z
	.string()
	.min(2)
	.max(400_000)
	.regex(/^(?:[0-9a-f]{2})+$/);

export const bitcoinRecoveryContentSchema = z
	.object({
		version: z.literal(1),
		secretId: z.string().uuid(),
		generation: z.number().int().positive(),
		network: bitcoinNetworkSchema,
		txHex: boundedHex,
		fundingTxId: hex64,
		fundingOutputIndex: z.number().int().nonnegative(),
		amountSats: z.number().int().positive(),
		timelockScriptHex: boundedHex,
		ttlBlocks: z.number().int().min(1).max(65535),
		recipientAddress: z.string().min(14).max(100),
		maxFeeSats: z.number().int().positive(),
		nostrCapsuleEventId: hex64,
		nostrManifestEvent: z.unknown(),
		nostrCapsuleEvent: z.unknown()
	})
	.strict();

export type BitcoinRecoveryContent = z.infer<typeof bitcoinRecoveryContentSchema>;

export const encryptedBitcoinEnvelopeSchema = z
	.object({
		version: z.literal(1),
		senderPubkey: hex64,
		recipientNostrPubkey: hex64,
		ciphertext: z.string().min(1).max(600_000)
	})
	.strict();

export type EncryptedBitcoinEnvelope = z.infer<typeof encryptedBitcoinEnvelopeSchema>;

export function encryptBitcoinRecoveryEnvelope(
	content: BitcoinRecoveryContent,
	senderSecretKey: Uint8Array,
	recipientNostrPubkey: string
): EncryptedBitcoinEnvelope {
	const parsed = bitcoinRecoveryContentSchema.parse(content);
	const senderPubkey = getPublicKey(senderSecretKey);
	const conversationKey = getConversationKey(senderSecretKey, recipientNostrPubkey);
	try {
		return encryptedBitcoinEnvelopeSchema.parse({
			version: 1,
			senderPubkey,
			recipientNostrPubkey,
			ciphertext: encrypt(JSON.stringify(parsed), conversationKey)
		});
	} finally {
		conversationKey.fill(0);
	}
}

export function decryptBitcoinRecoveryEnvelope(
	envelopeInput: unknown,
	recipientSecretKey: Uint8Array,
	expectedSenderPubkey: string
): BitcoinRecoveryContent {
	const envelope = encryptedBitcoinEnvelopeSchema.parse(envelopeInput);
	const recipientPubkey = getPublicKey(recipientSecretKey);
	if (envelope.recipientNostrPubkey !== recipientPubkey) {
		throw new Error('Bitcoin recovery envelope recipient mismatch');
	}
	if (envelope.senderPubkey !== expectedSenderPubkey) {
		throw new Error('Bitcoin recovery envelope sender mismatch');
	}
	const conversationKey = getConversationKey(recipientSecretKey, expectedSenderPubkey);
	try {
		return bitcoinRecoveryContentSchema.parse(
			JSON.parse(decrypt(envelope.ciphertext, conversationKey))
		);
	} finally {
		conversationKey.fill(0);
	}
}
