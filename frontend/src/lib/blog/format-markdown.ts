import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'ul',
	'ol',
	'li',
	'strong',
	'em',
	'a',
	'code',
	'pre',
	'blockquote',
	'hr',
	'br',
	'div',
	'span'
];

export function formatMarkdownContent(content: string): string {
	const rawHtml = marked.parse(content, { gfm: true, breaks: false }) as string;
	return sanitizeHtml(rawHtml, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			'*': ['class']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false
	});
}
