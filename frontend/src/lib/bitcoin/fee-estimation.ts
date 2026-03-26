/**
 * Fee rate estimation from public Bitcoin APIs.
 *
 * Uses mempool.space recommended fees API as primary source.
 */

/** Fee priority levels */
export type FeePriority = "low" | "medium" | "high"

/** mempool.space recommended fees response */
interface MempoolFeeEstimate {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
  minimumFee: number
}

/**
 * Estimate the current fee rate for a given priority level.
 *
 * Uses mempool.space's recommended fees API which provides
 * fee estimates based on current mempool conditions.
 *
 * @param priority - Fee priority ('low', 'medium', 'high')
 * @param network - Bitcoin network
 * @returns Fee rate in sats/vbyte
 */
export async function estimateFeeRate(
  priority: FeePriority = "medium",
  network: "mainnet" | "testnet" = "mainnet",
): Promise<number> {
  const baseUrl =
    network === "testnet"
      ? "https://mempool.space/testnet/api"
      : "https://mempool.space/api"

  try {
    const response = await fetch(`${baseUrl}/v1/fees/recommended`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const fees = (await response.json()) as MempoolFeeEstimate

    switch (priority) {
      case "high":
        return fees.fastestFee
      case "medium":
        return fees.halfHourFee
      case "low":
        return fees.economyFee
      default:
        return fees.halfHourFee
    }
  } catch (err) {
    // Fallback: return conservative defaults if API is unavailable
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`Fee estimation failed (${message}), using defaults`)

    switch (priority) {
      case "high":
        return 50
      case "medium":
        return 20
      case "low":
        return 5
      default:
        return 20
    }
  }
}

/**
 * Get all fee rate estimates at once.
 *
 * @param network - Bitcoin network
 * @returns Object with fee rates for each priority level
 */
export async function getAllFeeRates(
  network: "mainnet" | "testnet" = "mainnet",
): Promise<Record<FeePriority, number>> {
  const baseUrl =
    network === "testnet"
      ? "https://mempool.space/testnet/api"
      : "https://mempool.space/api"

  try {
    const response = await fetch(`${baseUrl}/v1/fees/recommended`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const fees = (await response.json()) as MempoolFeeEstimate

    return {
      high: fees.fastestFee,
      medium: fees.halfHourFee,
      low: fees.economyFee,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`Fee estimation failed (${message}), using defaults`)

    return {
      high: 50,
      medium: 20,
      low: 5,
    }
  }
}
