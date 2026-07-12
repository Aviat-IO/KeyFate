import { randomUUID } from 'node:crypto';
import { getDatabase } from '$lib/db/get-database';
import { secrets, type Secret, type SecretUpdate } from '$lib/db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';

const PROCESSING_LEASE_MS = 15 * 60 * 1000;
type Database = Awaited<ReturnType<typeof getDatabase>>;

export async function claimDisclosureSecret(
	db: Database,
	secretId: string,
	claimTime: Date = new Date()
): Promise<{ secret: Secret; leaseId: string } | null> {
	const leaseId = randomUUID();
	const [claimed] = await db
		.update(secrets)
		.set({
			status: 'triggered',
			processingStartedAt: claimTime,
			processingLeaseId: leaseId,
			processingLeaseExpiresAt: new Date(claimTime.getTime() + PROCESSING_LEASE_MS),
			updatedAt: claimTime
		} as SecretUpdate)
		.where(
			and(
				eq(secrets.id, secretId),
				or(
					eq(secrets.status, 'active'),
					and(
						eq(secrets.status, 'triggered'),
						isNull(secrets.triggeredAt),
						or(
							isNull(secrets.processingLeaseExpiresAt),
							lt(secrets.processingLeaseExpiresAt, claimTime)
						)
					)
				)
			)
		)
		.returning();

	return claimed ? { secret: claimed, leaseId } : null;
}
