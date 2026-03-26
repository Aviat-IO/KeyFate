/**
 * Module-scoped subscription tier cache.
 *
 * Shared across all NavBar instances so re-mounts don't re-fetch.
 */

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CachedTier {
  value: 'free' | 'pro'
  fetchedAt: number
  userId: string
}

let cachedTier: CachedTier | null = null

export function getCachedTier(userId: string): CachedTier['value'] | null {
  if (
    cachedTier &&
    cachedTier.userId === userId &&
    Date.now() - cachedTier.fetchedAt < CACHE_TTL_MS
  ) {
    return cachedTier.value
  }
  return null
}

export function setCachedTier(userId: string, value: CachedTier['value']): void {
  cachedTier = { value, fetchedAt: Date.now(), userId }
}
