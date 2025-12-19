import { getAllBlogPosts, getFeaturedPosts } from "@/lib/blog/posts"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowRight, BookOpen, Calendar, Clock } from "lucide-react"
import Link from "next/link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Expert guides on digital security, cryptocurrency protection, estate planning, and dead man's switch technology. Learn how to protect your most important digital assets.",
  openGraph: {
    title: "KeyFate Blog - Digital Security & Estate Planning",
    description:
      "Expert guides on digital security, cryptocurrency protection, and estate planning.",
    type: "website",
  },
}

export default function BlogPage() {
  const allPosts = getAllBlogPosts()
  const featuredPosts = getFeaturedPosts()
  const regularPosts = allPosts.filter((post) => !post.featured)

  return (
    <div className="container mx-auto px-4 py-16">
      <header className="mb-16 text-center">
        <Badge variant="outline" className="mb-4">
          <BookOpen className="mr-2 h-3 w-3" />
          Knowledge Base
        </Badge>
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          KeyFate Blog
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
          Expert guides on digital security, cryptocurrency protection, and
          estate planning. Learn how to protect your most important information.
        </p>
      </header>

      {featuredPosts.length > 0 && (
        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold">Featured Article</h2>
          {featuredPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <Card className="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{post.category}</Badge>
                    <Badge variant="outline">Featured</Badge>
                  </div>
                  <CardTitle className="text-2xl transition-colors group-hover:text-primary md:text-3xl">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </time>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{post.readingTime}</span>
                    </div>
                  </div>
                  <div className="text-primary mt-4 flex items-center gap-1 font-medium">
                    Read article
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-8 text-2xl font-bold">All Articles</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {regularPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <Card className="group h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <Badge variant="secondary" className="mb-2 w-fit">
                    {post.category}
                  </Badge>
                  <CardTitle className="line-clamp-2 transition-colors group-hover:text-primary">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-3">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </time>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{post.readingTime}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
