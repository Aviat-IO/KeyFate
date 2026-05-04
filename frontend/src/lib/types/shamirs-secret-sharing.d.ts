declare module 'shamirs-secret-sharing' {
	export class Buffer extends Uint8Array {
		static from(input: string, encoding?: string): Buffer;
		toString(encoding?: string): string;
	}

	export function split(secret: Buffer, options: { shares: number; threshold: number }): Buffer[];
	export function combine(shares: Array<Buffer | string>): Buffer;

	const sss: {
		Buffer: typeof Buffer;
		split: typeof split;
		combine: typeof combine;
	};
	export default sss;
}
