/**
 * Nostr relay configuration and health checking.
 *
 * Provides a curated list of recommended relays and utilities
 * to verify relay availability before publishing events.
 */

export interface RelayHealth {
  url: string
  healthy: boolean
  latencyMs: number | null
  lastChecked: Date
}

/** Default relays for gift-wrap delivery. Ordered by reliability. */
export const DEFAULT_RELAYS: readonly string[] = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.wine",
] as const

/** Timeout in ms for relay health checks. */
const HEALTH_CHECK_TIMEOUT_MS = 5_000

/**
 * Check whether a single relay is reachable by opening a WebSocket
 * and waiting for the connection to succeed.
 *
 * Returns a {@link RelayHealth} result regardless of outcome.
 */
export async function checkRelayHealth(url: string): Promise<RelayHealth> {
  const start = Date.now()

  try {
    const healthy = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        ws.close()
        resolve(false)
      }, HEALTH_CHECK_TIMEOUT_MS)

      const ws = new WebSocket(url)

      ws.onopen = () => {
        clearTimeout(timeout)
        ws.close()
        resolve(true)
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        ws.close()
        resolve(false)
      }
    })

    return {
      url,
      healthy,
      latencyMs: healthy ? Date.now() - start : null,
      lastChecked: new Date(),
    }
  } catch {
    return {
      url,
      healthy: false,
      latencyMs: null,
      lastChecked: new Date(),
    }
  }
}

/**
 * Check all provided relays (or the defaults) and return only the healthy ones,
 * sorted by latency (fastest first).
 */
export async function getHealthyRelays(
  relays: readonly string[] = DEFAULT_RELAYS,
): Promise<RelayHealth[]> {
  const results = await Promise.all(relays.map(checkRelayHealth))
  return results
    .filter((r) => r.healthy)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
}
