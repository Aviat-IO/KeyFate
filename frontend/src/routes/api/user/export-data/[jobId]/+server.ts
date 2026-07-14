import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSession } from '$lib/server/auth';
import { getExportJob } from '$lib/gdpr/export-service';

const MAX_DOWNLOADS = 3;

/**
 * GET /api/user/export-data/[jobId]
 * Read owner-bound export status. Polling never consumes a download.
 */
export const GET: RequestHandler = async (event) => {
	try {
		const session = await requireSession(event);
		const job = await getExportJob(event.params.jobId, session.user.id);

		if (!job) {
			return json({ error: 'Export not found' }, { status: 404 });
		}

		if (new Date() > job.expiresAt) {
			return json({ error: 'Export link has expired', code: 'EXPIRED' }, { status: 410 });
		}

		if (job.status === 'completed') {
			return json({
				status: job.status,
				downloadUrl:
					job.downloadCount < MAX_DOWNLOADS ? `/api/user/export-data/${job.id}/download` : null,
				fileSize: job.fileSize,
				downloadCount: job.downloadCount,
				expiresAt: job.expiresAt,
				createdAt: job.createdAt
			});
		}

		return json({
			status: job.status,
			createdAt: job.createdAt,
			errorMessage: job.errorMessage
		});
	} catch (error) {
		if (error instanceof Error && 'status' in error) throw error;
		console.error('Error in GET /api/user/export-data/[jobId]:', error);
		return json({ error: 'Failed to retrieve export' }, { status: 500 });
	}
};
