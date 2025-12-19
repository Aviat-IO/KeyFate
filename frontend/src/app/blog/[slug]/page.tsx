import { getAllBlogPosts, getBlogPost } from "@/lib/blog/posts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NEXT_PUBLIC_SITE_URL } from "@/lib/env"
import { ArrowLeft, Calendar, Clock, User } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import sanitizeHtml from "sanitize-html"
import { marked } from "marked"

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    return {
      title: "Post Not Found",
    }
  }

  const siteUrl = NEXT_PUBLIC_SITE_URL || "https://keyfate.com"
  const canonicalUrl = `${siteUrl}/blog/${slug}`

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags.join(", "),
    authors: [{ name: post.author }],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: canonicalUrl,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: [...post.tags],
      siteName: "KeyFate",
      images: [
        {
          url: `${siteUrl}/og/blog-default.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${siteUrl}/og/blog-default.png`],
    },
  }
}

// Configure marked for consistent output
marked.setOptions({
  gfm: true,
  breaks: false,
})

function formatMarkdownContent(content: string): string {
  // Parse markdown to HTML
  const rawHtml = marked.parse(content) as string

  // Sanitize to prevent XSS
  const sanitizedHtml = sanitizeHtml(rawHtml, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "a",
      "code",
      "pre",
      "blockquote",
      "hr",
      "br",
      "div",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["class"],
    },
  })

  return sanitizedHtml
}

function generateJsonLd(post: {
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  author: string
  slug: string
}) {
  const siteUrl = NEXT_PUBLIC_SITE_URL || "https://keyfate.com"

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    url: `${siteUrl}/blog/${post.slug}`,
    author: {
      "@type": "Organization",
      name: post.author,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "KeyFate",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/${post.slug}`,
    },
    image: `${siteUrl}/og/blog-default.png`,
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)

  if (!post) {
    notFound()
  }

  const jsonLd = generateJsonLd(post)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="container mx-auto max-w-4xl px-4 py-16">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Link>
          </Button>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{post.category}</Badge>
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <p className="text-muted-foreground mb-6 text-xl leading-relaxed">
            {post.description}
          </p>

          <div className="text-muted-foreground flex flex-wrap items-center gap-6 border-b pb-6 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{post.author}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{post.readingTime}</span>
            </div>
          </div>
        </div>

        <div
          className="prose prose-lg max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-1"
          dangerouslySetInnerHTML={{
            __html: formatMarkdownContent(post.content),
          }}
        />

        <footer className="mt-16 border-t pt-8">
          <div className="bg-muted/50 rounded-lg p-6">
            <h3 className="mb-2 text-lg font-semibold">
              Protect Your Digital Legacy
            </h3>
            <p className="text-muted-foreground mb-4">
              Ready to secure your cryptocurrency, passwords, and sensitive
              information for your loved ones?
            </p>
            <Button asChild>
              <Link href="/auth/signin">Get Started with KeyFate</Link>
            </Button>
          </div>
        </footer>
      </article>
    </>
  )
}
