<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { ArrowRight, BookOpen, Calendar, Clock } from 'lucide-svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>Blog - KeyFate</title>
  <meta
    name="description"
    content="Expert guides on digital security, cryptocurrency protection, estate planning, and dead man's switch technology."
  />
</svelte:head>

<div class="container mx-auto px-4 py-16">
  <header class="mb-16 text-center">
    <Badge variant="outline" class="mb-4">
      <BookOpen class="mr-2 h-3 w-3" />
      Knowledge Base
    </Badge>
    <h1 class="mb-4 text-4xl font-bold tracking-tight md:text-5xl">KeyFate Blog</h1>
    <p class="text-muted-foreground mx-auto max-w-2xl text-xl">
      Expert guides on digital security, cryptocurrency protection, and estate planning. Learn how
      to protect your most important information.
    </p>
  </header>

  {#if data.featuredPosts.length > 0}
    <section class="mb-16">
      <h2 class="mb-8 text-2xl font-bold">Featured Article</h2>
      {#each data.featuredPosts as post}
        <a href="/blog/{post.slug}">
          <Card.Root
            class="group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <Card.Header>
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{post.category}</Badge>
                <Badge variant="outline">Featured</Badge>
              </div>
              <Card.Title
                class="text-2xl transition-colors group-hover:text-primary md:text-3xl"
              >
                {post.title}
              </Card.Title>
              <Card.Description class="text-base">{post.description}</Card.Description>
            </Card.Header>
            <Card.Content>
              <div class="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4" />
                  <time datetime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>
                </div>
                <div class="flex items-center gap-1">
                  <Clock class="h-4 w-4" />
                  <span>{post.readingTime}</span>
                </div>
              </div>
              <div
                class="text-primary mt-4 flex items-center gap-1 font-medium"
              >
                Read article
                <ArrowRight
                  class="h-4 w-4 transition-transform group-hover:translate-x-1"
                />
              </div>
            </Card.Content>
          </Card.Root>
        </a>
      {/each}
    </section>
  {/if}

  <section>
    <h2 class="mb-8 text-2xl font-bold">All Articles</h2>
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each data.regularPosts as post}
        <a href="/blog/{post.slug}">
          <Card.Root
            class="group h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <Card.Header>
              <Badge variant="secondary" class="mb-2 w-fit">{post.category}</Badge>
              <Card.Title
                class="line-clamp-2 transition-colors group-hover:text-primary"
              >
                {post.title}
              </Card.Title>
              <Card.Description class="line-clamp-3">{post.description}</Card.Description>
            </Card.Header>
            <Card.Content>
              <div class="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                <div class="flex items-center gap-1">
                  <Calendar class="h-4 w-4" />
                  <time datetime={post.publishedAt}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </time>
                </div>
                <div class="flex items-center gap-1">
                  <Clock class="h-4 w-4" />
                  <span>{post.readingTime}</span>
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </a>
      {/each}
    </div>
  </section>
</div>
