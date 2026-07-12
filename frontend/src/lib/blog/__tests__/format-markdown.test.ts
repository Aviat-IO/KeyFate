import { describe, expect, it } from 'vitest';
import { formatMarkdownContent } from '../format-markdown';

describe('formatMarkdownContent', () => {
	it('preserves the narrow trusted blog markup', () => {
		const html = formatMarkdownContent('# Heading\n\n**Strong** [link](https://keyfate.com)');

		expect(html).toContain('<h1>Heading</h1>');
		expect(html).toContain('<strong>Strong</strong>');
		expect(html).toContain('href="https://keyfate.com"');
	});

	it('removes scripts, event handlers, and dangerous URL schemes', () => {
		const html = formatMarkdownContent(
			'<script>audit()</script><img src=x onerror=audit()><a href="javascript:audit()">x</a>'
		);

		expect(html).not.toContain('<script');
		expect(html).not.toContain('onerror');
		expect(html).not.toContain('javascript:');
	});

	it('does not expose raw XMP contents as active HTML', () => {
		const html = formatMarkdownContent('<xmp><script>audit()</script></xmp>');

		expect(html).not.toContain('<script');
		expect(html).not.toContain('audit()');
	});
});
