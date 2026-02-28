/**
 * Nostr relay pool management, event publishing, and querying.
 *
 * Provides a singleton-style pool that lazily connects to relays
 * and exposes typed helpers for publishing gift-wrapped events
 * and querying events by filter.
 */

import { SimplePool } from "nostr-tools/pool"
import type { Event as NostrEvent } from "nostr-tools/core"
import type { Filter } from "nostr-tools/filter"
import { DEFAULT_RELAYS } from "./relay-config"

export type { Filter }

/** Options for the Nostr client. */
export interface NostrClientOptions {
  /** Relay URLs to use. Defaults to {@link DEFAULT_RELAYS}. */
  relays?: string[]
}

/**
 * Thin wrapper around nostr-tools' SimplePool.
 *
 * Manages relay connections and provides typed publish/query methods.
 */
export class NostrClient {
  private pool: SimplePool
  private relays: string[]

  constructor(options: NostrClientOptions = {}) {
    this.pool = new SimplePool()
    this.relays = [...(options.relays ?? DEFAULT_RELAYS)]
  }

  /** The relay URLs this client is configured to use. */
  getRelays(): readonly string[] {
    return this.relays
  }

  /** Replace the relay list at runtime. */
  setRelays(relays: string[]): void {
    this.relays = [...relays]
  }

  /**
   * Publish a signed event to all configured relays.
   *
   * Resolves when at least one relay accepts the event.
   * Rejects if no relay accepts it.
   */
  async publish(event: NostrEvent): Promise<void> {
    await Promise.any(this.pool.publish(this.relays, event))
  }

  /**
   * Query relays for events matching a filter.
   *
   * Returns all matching events collected from all relays.
   */
  async query(filter: Filter): Promise<NostrEvent[]> {
    return this.pool.querySync(this.relays, filter)
  }

  /**
   * Fetch a single event matching a filter.
   *
   * Returns null if no event is found.
   */
  async get(filter: Filter): Promise<NostrEvent | null> {
    return this.pool.get(this.relays, filter)
  }

  /**
   * Close all relay connections and release resources.
   */
  close(): void {
    this.pool.close(this.relays)
  }
}

/**
 * Create a new NostrClient instance.
 *
 * Prefer creating one client per operation batch and calling
 * {@link NostrClient.close} when done.
 */
export function createNostrClient(
  options?: NostrClientOptions,
): NostrClient {
  return new NostrClient(options)
}
