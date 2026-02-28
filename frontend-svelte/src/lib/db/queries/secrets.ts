import { getDatabase } from "$lib/db/get-database"
import { secrets, secretRecipients } from "$lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import type {
  SecretWithRecipients,
  SecretRecipient,
  RecipientInput,
} from "$lib/types/secret-types"

export async function getSecretWithRecipients(
  secretId: string,
  userId: string,
): Promise<SecretWithRecipients | null> {
  const db = await getDatabase()
  const result = await db
    .select({
      secret: secrets,
      recipients: sql<SecretRecipient[]>`
        COALESCE(
          json_agg(
            json_build_object(
              'id', ${secretRecipients.id},
              'secretId', ${secretRecipients.secretId},
              'name', ${secretRecipients.name},
              'email', ${secretRecipients.email},
              'phone', ${secretRecipients.phone},
              'createdAt', ${secretRecipients.createdAt},
              'updatedAt', ${secretRecipients.updatedAt}
            )
            ORDER BY ${secretRecipients.createdAt} ASC
          ) FILTER (WHERE ${secretRecipients.id} IS NOT NULL),
          '[]'::json
        )
      `,
    })
    .from(secrets)
    .leftJoin(secretRecipients, eq(secrets.id, secretRecipients.secretId))
    .where(and(eq(secrets.id, secretId), eq(secrets.userId, userId)))
    .groupBy(secrets.id)

  if (!result || result.length === 0) {
    return null
  }

  const row = result[0]
  return {
    ...row.secret,
    recipients: row.recipients || [],
  }
}

export async function getAllSecretsWithRecipients(
  userId: string,
): Promise<SecretWithRecipients[]> {
  const db = await getDatabase()
  const result = await db
    .select({
      secret: secrets,
      recipients: sql<SecretRecipient[]>`
        COALESCE(
          json_agg(
            json_build_object(
              'id', ${secretRecipients.id},
              'secretId', ${secretRecipients.secretId},
              'name', ${secretRecipients.name},
              'email', ${secretRecipients.email},
              'phone', ${secretRecipients.phone},
              'createdAt', ${secretRecipients.createdAt},
              'updatedAt', ${secretRecipients.updatedAt}
            )
            ORDER BY ${secretRecipients.createdAt} ASC
          ) FILTER (WHERE ${secretRecipients.id} IS NOT NULL),
          '[]'::json
        )
      `,
    })
    .from(secrets)
    .leftJoin(secretRecipients, eq(secrets.id, secretRecipients.secretId))
    .where(eq(secrets.userId, userId))
    .groupBy(secrets.id)

  return result.map((row) => ({
    ...row.secret,
    recipients: row.recipients || [],
  }))
}

export async function getAllRecipients(
  secretId: string,
): Promise<SecretRecipient[]> {
  const db = await getDatabase()
  return db
    .select()
    .from(secretRecipients)
    .where(eq(secretRecipients.secretId, secretId))
    .orderBy(secretRecipients.createdAt)
}

export async function updateSecretRecipients(
  secretId: string,
  recipientsData: RecipientInput[],
): Promise<void> {
  const db = await getDatabase()
  await db.transaction(async (tx) => {
    await tx
      .delete(secretRecipients)
      .where(eq(secretRecipients.secretId, secretId))

    const recipientsToInsert = recipientsData.map((r) => ({
      name: r.name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      secretId,
    }))

    if (recipientsToInsert.length > 0) {
      await tx.insert(secretRecipients).values(recipientsToInsert)
    }
  })
}
