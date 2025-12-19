/**
 * Blog category union type for type-safe category assignment
 */
export type BlogCategoryType =
  | "Education"
  | "Cryptocurrency"
  | "Technology"
  | "Estate Planning"
  | "Security"

/**
 * Blog post interface with strict typing
 */
export interface BlogPost {
  slug: string
  title: string
  description: string
  content: string
  publishedAt: string
  updatedAt?: string
  author: string
  category: BlogCategoryType
  tags: readonly string[]
  readingTime: string
  featured?: boolean
}

/**
 * Blog category metadata for category pages
 */
export interface BlogCategory {
  name: BlogCategoryType
  slug: string
  description: string
}
