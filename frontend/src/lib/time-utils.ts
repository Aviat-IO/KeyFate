/**
 * Time formatting utilities for displaying time differences
 */

/**
 * Formats time remaining from days into human-readable format
 * Uses floor to err on the side of urgency (shows less time = more urgent)
 * Handles floating point precision issues with threshold-based rounding
 * - >= 1 day: "n days" (floor)
 * - >= 1 hour: "n hours" (floor)
 * - < 1 hour: "n minutes" (floor)
 * - 0 or very small: "less than a minute"
 *
 * @param daysRemaining - Number of days remaining (can be fractional)
 * @returns Formatted time string
 *
 * @example
 * formatTimeRemaining(3.5) // "3 days"
 * formatTimeRemaining(0.5) // "12 hours"
 * formatTimeRemaining(0.04166666666) // "1 hour" (1.0 hours after rounding)
 * formatTimeRemaining(0.02) // "30 minutes" (0.5 hours = 30 minutes)
 * formatTimeRemaining(0) // "less than a minute"
 */
export function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining <= 0) {
    return "less than a minute";
  }

  if (daysRemaining < 1) {
    const hours = daysRemaining * 24;
    
    if (hours >= 1) {
      // Display in hours when >= 1 hour, round down for urgency
      // Use threshold to handle floating point: if within 0.001 of an integer, round to it
      const hoursInt = Math.floor(hours + 0.001);
      return hoursInt === 1 ? "1 hour" : `${hoursInt} hours`;
    } else {
      // Display in minutes when < 1 hour, round down for urgency
      const minutes = hours * 60;
      // Use threshold to handle floating point: if within 0.01 of an integer, round to it
      const minutesInt = Math.floor(minutes + 0.01);
      
      if (minutesInt === 0) {
        return "less than a minute";
      }
      
      // Handle case where minutes rounds to 60 or more (should be displayed as hours)
      if (minutesInt >= 60) {
        const hoursFromMinutes = Math.floor(minutesInt / 60);
        return hoursFromMinutes === 1 ? "1 hour" : `${hoursFromMinutes} hours`;
      }
      
      return minutesInt === 1 ? "1 minute" : `${minutesInt} minutes`;
    }
  }

  // Days: round down to whole days
  // Use threshold to handle floating point
  const days = Math.floor(daysRemaining + 0.0001);
  return days === 1 ? "1 day" : `${days} days`;
}

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
