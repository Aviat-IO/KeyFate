/**
 * Time formatting utilities for displaying time differences
 */

/**
 * Formats time difference into granular display for SecretCard
 * - >24 hours: "n days"
 * - 1-24 hours: "n hours"
 * - <1 hour: "n minutes"
 *
 * @param futureDate - The target date to calculate difference from now
 * @returns Formatted time string
 *
 * @example
 * formatGranularTime(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)) // "3 days"
 * formatGranularTime(new Date(Date.now() + 5 * 60 * 60 * 1000)) // "5 hours"
 * formatGranularTime(new Date(Date.now() + 45 * 60 * 1000)) // "45 minutes"
 */
export function formatGranularTime(futureDate: Date | string): string {
  const future = typeof futureDate === 'string' ? new Date(futureDate) : futureDate
  const now = new Date()
  const diffMs = future.getTime() - now.getTime()

  // Handle past dates
  if (diffMs < 0) {
    const absDiffMs = Math.abs(diffMs)
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor(absDiffMs / (1000 * 60 * 60))
    const minutes = Math.floor(absDiffMs / (1000 * 60))

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ago`
    } else if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
    }
  }

  // Future dates
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor(diffMs / (1000 * 60))

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`
  } else if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  } else {
    return "less than a minute"
  }
}
