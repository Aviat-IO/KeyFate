/**
 * Pagination Utilities
 *
 * Provides cursor-based and offset-based pagination for API endpoints
 */

import { z } from "zod"

/**
 * Pagination configuration
 */
export const PAGINATION_CONFIG = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const

/**
 * Offset-based pagination parameters schema
 */
export const offsetPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_CONFIG.MIN_LIMIT)
    .max(PAGINATION_CONFIG.MAX_LIMIT)
    .default(PAGINATION_CONFIG.DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
})

/**
 * Cursor-based pagination parameters schema
 */
export const cursorPaginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_CONFIG.MIN_LIMIT)
    .max(PAGINATION_CONFIG.MAX_LIMIT)
    .default(PAGINATION_CONFIG.DEFAULT_LIMIT),
  cursor: z.string().optional(),
})

/**
 * Offset pagination parameters
 */
export type OffsetPaginationParams = z.infer<typeof offsetPaginationSchema>

/**
 * Cursor pagination parameters
 */
export type CursorPaginationParams = z.infer<typeof cursorPaginationSchema>

/**
 * Pagination metadata for offset-based pagination
 */
export interface OffsetPaginationMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  totalPages: number
  currentPage: number
}

/**
 * Cursor pagination metadata
 */
export interface CursorPaginationMeta {
  limit: number
  hasMore: boolean
  nextCursor: string | null
  previousCursor: string | null
}

/**
 * Paginated response structure for offset pagination
 */
export interface OffsetPaginatedResponse<T> {
  data: T[]
  pagination: OffsetPaginationMeta
}

/**
 * Paginated response structure for cursor pagination
 */
export interface CursorPaginatedResponse<T> {
  data: T[]
  pagination: CursorPaginationMeta
}

/**
 * Parse and validate offset pagination params from URL search params
 */
export function parseOffsetPagination(
  searchParams: URLSearchParams,
): OffsetPaginationParams {
  return offsetPaginationSchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  })
}

/**
 * Parse and validate cursor pagination params from URL search params
 */
export function parseCursorPagination(
  searchParams: URLSearchParams,
): CursorPaginationParams {
  return cursorPaginationSchema.parse({
    limit: searchParams.get("limit"),
    cursor: searchParams.get("cursor"),
  })
}

/**
 * Create offset pagination metadata
 */
export function createOffsetPaginationMeta(
  total: number,
  limit: number,
  offset: number,
): OffsetPaginationMeta {
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1
  const hasMore = offset + limit < total

  return {
    total,
    limit,
    offset,
    hasMore,
    totalPages,
    currentPage,
  }
}

/**
 * Create cursor pagination metadata
 */
export function createCursorPaginationMeta<T extends { id: string }>(
  items: T[],
  limit: number,
  requestedLimit: number,
): CursorPaginationMeta {
  // We fetch limit + 1 to determine if there are more items
  const hasMore = items.length > requestedLimit
  const dataItems = hasMore ? items.slice(0, requestedLimit) : items

  const nextCursor =
    hasMore && dataItems.length > 0 ? dataItems[dataItems.length - 1].id : null

  const previousCursor = dataItems.length > 0 ? dataItems[0].id : null

  return {
    limit: requestedLimit,
    hasMore,
    nextCursor,
    previousCursor,
  }
}

/**
 * Build paginated response for offset pagination
 */
export function buildOffsetPaginatedResponse<T>(
  data: T[],
  total: number,
  params: OffsetPaginationParams,
): OffsetPaginatedResponse<T> {
  return {
    data,
    pagination: createOffsetPaginationMeta(total, params.limit, params.offset),
  }
}

/**
 * Build paginated response for cursor pagination
 */
export function buildCursorPaginatedResponse<T extends { id: string }>(
  items: T[],
  params: CursorPaginationParams,
): CursorPaginatedResponse<T> {
  const hasMore = items.length > params.limit
  const data = hasMore ? items.slice(0, params.limit) : items

  return {
    data,
    pagination: createCursorPaginationMeta(items, params.limit, params.limit),
  }
}

/**
 * Encode cursor (base64 encode the ID)
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id).toString("base64url")
}

/**
 * Decode cursor (base64 decode to get the ID)
 */
export function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, "base64url").toString("utf-8")
  } catch {
    throw new Error("Invalid cursor format")
  }
}

/**
 * Calculate SQL LIMIT for cursor pagination (fetch +1 to detect hasMore)
 */
export function getCursorLimit(requestedLimit: number): number {
  return Math.min(requestedLimit + 1, PAGINATION_CONFIG.MAX_LIMIT + 1)
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
  limit?: number
  offset?: number
  cursor?: string
}): void {
  if (params.limit !== undefined) {
    if (params.limit < PAGINATION_CONFIG.MIN_LIMIT) {
      throw new Error(`Limit must be at least ${PAGINATION_CONFIG.MIN_LIMIT}`)
    }
    if (params.limit > PAGINATION_CONFIG.MAX_LIMIT) {
      throw new Error(`Limit cannot exceed ${PAGINATION_CONFIG.MAX_LIMIT}`)
    }
  }

  if (params.offset !== undefined && params.offset < 0) {
    throw new Error("Offset must be non-negative")
  }

  if (params.cursor && params.offset !== undefined) {
    throw new Error("Cannot use both cursor and offset pagination")
  }
}

/**
 * Build pagination links for responses
 */
export function buildPaginationLinks(
  baseUrl: string,
  params: OffsetPaginationParams,
  meta: OffsetPaginationMeta,
): {
  first: string
  last: string
  next: string | null
  prev: string | null
} {
  const buildUrl = (offset: number) => {
    const url = new URL(baseUrl)
    url.searchParams.set("limit", String(params.limit))
    url.searchParams.set("offset", String(offset))
    return url.toString()
  }

  const lastOffset = Math.max(0, (meta.totalPages - 1) * params.limit)

  return {
    first: buildUrl(0),
    last: buildUrl(lastOffset),
    next: meta.hasMore ? buildUrl(params.offset + params.limit) : null,
    prev:
      params.offset > 0
        ? buildUrl(Math.max(0, params.offset - params.limit))
        : null,
  }
}
