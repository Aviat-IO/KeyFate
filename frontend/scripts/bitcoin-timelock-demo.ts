#!/usr/bin/env bun

import { buildBitcoinTimelockDemo } from '../src/lib/bitcoin/timelock-demo.js';
import type { BitcoinTimelockNetwork } from '../src/lib/bitcoin/script.js';

function readArg(name: string): string | undefined {
	const prefix = `--${name}=`;
	return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseNetwork(value: string | undefined): BitcoinTimelockNetwork {
	const network = value ?? 'signet';
	if (network !== 'signet' && network !== 'testnet' && network !== 'mainnet') {
		throw new Error(`Invalid --network=${network}; expected signet, testnet, or mainnet`);
	}
	return network;
}

function parsePositiveNumber(name: string, fallback: number): number {
	const raw = readArg(name);
	if (raw === undefined) return fallback;
	const value = Number(raw);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`Invalid --${name}=${raw}; expected a positive number`);
	}
	return value;
}

const vector = buildBitcoinTimelockDemo({
	network: parseNetwork(readArg('network')),
	days: parsePositiveNumber('days', 7),
	amountSats: parsePositiveNumber('amount-sats', 10_000),
	ownerSeed: readArg('owner-seed'),
	recipientSeed: readArg('recipient-seed')
});

console.log(JSON.stringify(vector, null, 2));
