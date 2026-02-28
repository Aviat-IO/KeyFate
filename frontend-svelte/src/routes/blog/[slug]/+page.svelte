<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { ArrowLeft, Calendar, Clock, User } from 'lucide-svelte';
  import { marked } from 'marked';
  import sanitizeHtml from 'sanitize-html';

  let { data } = $props();

  marked.setOptions({ gfm: true, breaks: false });

  function formatMarkdownContent(content: string): string {
    const rawHtml = marked.parse(content) as string;
    return sanitizeHtml(rawHtml, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li',
        'strong', 'em', 'a', 'code', 'pre', 'blockquote', 'hr', 'br', 'div', 'span'
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        '*': ['class']
      }
    });
  }

  const siteUrl = 'https://keyfate.com';

  const jsonLd = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.post.title,
      description: data.post.description,
      datePublished: data.post.publishedAt,
      dateModified: data.post.updatedAt || data.post.publishedAt,
      url: `${siteUrl}/blog/${data.post.slug}`,
      author: {
        '@type': 'Organization',
        name: data.post.author,
        url: siteUrl
      },
      publisher: {
        '@type': 'Organization',
        name: 'KeyFate',
        url: siteUrl
      }
    })
  );

  const htmlContent = $derived(formatMarkdownContent(data.post.content));
</script>

<svelte:head>
  <title>{data.post.title} - KeyFate Blog</title>
  <meta name="description" content={data.post.description} />
  <meta name="keywords" content={data.post.tags.join(', ')} />
  <meta property="og:title" content={data.post.title} />
  <meta property="og:description" content={data.post.description} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{siteUrl}/blog/{data.post.slug}" />
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<article class="container mx-auto max-w-4xl px-4 py-16">
  <div class="mb-8">
    <Button variant="ghost" size="sm" href="/blog" class="mb-6">
      <ArrowLeft class="mr-2 h-4 w-4" />
      Back to Blog
    </Button>

    <div class="mb-4 flex flex-wrap items-center gap-2">
      <Badge variant="secondary">{data.post.category}</Badge>
      {#each data.post.tags.slice(0, 3) as tag}
        <Badge variant="outline">{tag}</Badge>
      {/each}
    </div>

    <h1 class="mb-6 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
      {data.post.title}
    </h1>

    <p class="text-muted-foreground mb-6 text-xl leading-relaxed">
      {data.post.description}
    </p>

    <div
      class="text-muted-foreground flex flex-wrap items-center gap-6 border-b pb-6 text-sm"
    >
      <div class="flex items-center gap-2">
        <User class="h-4 w-4" />
        <span>{data.post.author}</span>
      </div>
      <div class="flex items-center gap-2">
        <Calendar class="h-4 w-4" />
        <time datetime={data.post.publishedAt}>
          {new Date(data.post.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </time>
      </div>
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4" />
        <span>{data.post.readingTime}</span>
      </div>
    </div>
  </div>

  <div
    class="prose prose-lg max-w-none prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-1"
  >
    {@html htmlContent}
  </div>

  <footer class="mt-16 border-t pt-8">
    <div class="bg-muted/50 rounded-lg p-6">
      <h3 class="mb-2 text-lg font-semibold">Protect Your Digital Legacy</h3>
      <p class="text-muted-foreground mb-4">
        Ready to secure your cryptocurrency, passwords, and sensitive information for your loved
        ones?
      </p>
      <Button href="/auth/signin">Get Started with KeyFate</Button>
    </div>
  </footer>
</article>
