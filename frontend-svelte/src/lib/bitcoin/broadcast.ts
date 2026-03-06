/**
 * Transaction broadcasting via public Bitcoin APIs.
 *
 * Uses mempool.space as primary and blockstream.info as fallback.
 */

/** Status of a UTXO on the blockchain */
export interface UTXOStatus {
  /** Whether the UTXO exists and is confirmed */
  confirmed: boolean
  /** Block height of confirmation (if confirmed) */
  blockHeight?: number
  /** Whether the UTXO has been spent */
  spent: boolean
  /** Transaction ID that spent this UTXO (if spent) */
  spentByTxId?: string
}

interface BroadcastEndpoint {
  name: string
  url: string
}

function getEndpoints(network: "mainnet" | "testnet"): BroadcastEndpoint[] {
  if (network === "testnet") {
    return [
      {
        name: "mempool.space",
        url: "https://mempool.space/testnet/api/tx",
      },
      {
        name: "blockstream.info",
        url: "https://blockstream.info/testnet/api/tx",
      },
    ]
  }
  return [
    { name: "mempool.space", url: "https://mempool.space/api/tx" },
    { name: "blockstream.info", url: "https://blockstream.info/api/tx" },
  ]
}

function getStatusEndpoints(
  network: "mainnet" | "testnet",
): { mempool: string; blockstream: string } {
  if (network === "testnet") {
    return {
      mempool: "https://mempool.space/testnet/api",
      blockstream: "https://blockstream.info/testnet/api",
    }
  }
  return {
    mempool: "https://mempool.space/api",
    blockstream: "https://blockstream.info/api",
  }
}

/**
 * Broadcast a signed transaction to the Bitcoin network.
 *
 * Tries mempool.space first, falls back to blockstream.info.
 *
 * @param txHex - Hex-encoded signed transaction
 * @param network - Bitcoin network
 * @returns Transaction ID
 * @throws Error if all broadcast attempts fail
 */
export async function broadcastTransaction(
  txHex: string,
  network: "mainnet" | "testnet" = "mainnet",
): Promise<string> {
  const endpoints = getEndpoints(network)
  const errors: string[] = []

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: txHex,
      })

      if (response.ok) {
        const txId = await response.text()
        return txId.trim()
      }

      const errorText = await response.text()
      errors.push(`${endpoint.name}: HTTP ${response.status} - ${errorText}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${endpoint.name}: ${message}`)
    }
  }

  throw new Error(
    `Failed to broadcast transaction via all endpoints:\n${errors.join("\n")}`,
  )
}

/**
 * Get the status of a UTXO (confirmed, spent, etc.).
 *
 * @param txId - Transaction ID containing the UTXO
 * @param outputIndex - Output index within the transaction
 * @param network - Bitcoin network
 * @returns UTXO status
 */
export async function getUTXOStatus(
  txId: string,
  outputIndex: number,
  network: "mainnet" | "testnet" = "mainnet",
): Promise<UTXOStatus> {
  const endpoints = getStatusEndpoints(network)
  const errors: string[] = []

  // Try mempool.space first
  try {
    // Get transaction status
    const txResponse = await fetch(`${endpoints.mempool}/tx/${txId}`)
    if (txResponse.ok) {
      const txData = (await txResponse.json()) as {
        status?: { confirmed?: boolean; block_height?: number }
      }
      const confirmed = txData.status?.confirmed ?? false
      const blockHeight = txData.status?.block_height

      // Check if the output has been spent
      const outspendResponse = await fetch(
        `${endpoints.mempool}/tx/${txId}/outspend/${outputIndex}`,
      )
      if (outspendResponse.ok) {
        const outspendData = (await outspendResponse.json()) as {
          spent?: boolean
          txid?: string
        }
        return {
          confirmed,
          blockHeight,
          spent: outspendData.spent ?? false,
          spentByTxId: outspendData.txid,
        }
      }
    }
    errors.push(`mempool.space: HTTP ${txResponse.status}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(`mempool.space: ${message}`)
  }

  // Fallback to blockstream.info
  try {
    const txResponse = await fetch(`${endpoints.blockstream}/tx/${txId}`)
    if (txResponse.ok) {
      const txData = (await txResponse.json()) as {
        status?: { confirmed?: boolean; block_height?: number }
      }
      const confirmed = txData.status?.confirmed ?? false
      const blockHeight = txData.status?.block_height

      const outspendResponse = await fetch(
        `${endpoints.blockstream}/tx/${txId}/outspend/${outputIndex}`,
      )
      if (outspendResponse.ok) {
        const outspendData = (await outspendResponse.json()) as {
          spent?: boolean
          txid?: string
        }
        return {
          confirmed,
          blockHeight,
          spent: outspendData.spent ?? false,
          spentByTxId: outspendData.txid,
        }
      }
    }
    errors.push(`blockstream.info: HTTP ${txResponse.status}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    errors.push(`blockstream.info: ${message}`)
  }

  throw new Error(
    `Failed to get UTXO status from all endpoints:\n${errors.join("\n")}`,
  )
}
