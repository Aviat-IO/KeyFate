import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const MAX_EXPORT_BYTES = 5 * 1024 * 1024;

export interface ExportArtifact {
	encodedData: string;
	fileSize: number;
	storedSize: number;
	sha256: string;
	contentType: 'application/json';
}

function digest(data: Uint8Array): string {
	return createHash('sha256').update(data).digest('hex');
}

export async function createExportArtifact(data: unknown): Promise<ExportArtifact> {
	const bytes = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
	if (bytes.byteLength > MAX_EXPORT_BYTES) {
		throw new Error(`Export exceeds the ${MAX_EXPORT_BYTES}-byte limit`);
	}

	const compressed = await gzipAsync(bytes, { level: 9 });
	return {
		encodedData: compressed.toString('base64'),
		fileSize: bytes.byteLength,
		storedSize: compressed.byteLength,
		sha256: digest(bytes),
		contentType: 'application/json'
	};
}

export async function decodeExportArtifact(
	encodedData: string,
	expectedSize: number,
	expectedSha256: string
): Promise<Uint8Array> {
	const bytes = await gunzipAsync(Buffer.from(encodedData, 'base64'));
	if (bytes.byteLength !== expectedSize || digest(bytes) !== expectedSha256) {
		throw new Error('Export artifact integrity check failed');
	}
	return bytes;
}
