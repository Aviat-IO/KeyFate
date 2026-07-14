import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const providers = {
		google: !!(
			process.env.AUTH_GOOGLE_ID &&
			process.env.AUTH_GOOGLE_SECRET &&
			process.env.AUTH_GOOGLE_ID !== 'your-google-client-id.apps.googleusercontent.com' &&
			process.env.AUTH_GOOGLE_SECRET !== 'your-google-client-secret' &&
			process.env.AUTH_GOOGLE_ID.endsWith('.apps.googleusercontent.com')
		),
		email: !!(
			process.env.SENDGRID_API_KEY &&
			process.env.SENDGRID_ADMIN_EMAIL &&
			process.env.SENDGRID_API_KEY !== 'your-sendgrid-api-key'
		)
	};

	return json(providers);
};
