<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import type { Snippet } from 'svelte';

  let {
    title,
    description,
    children,
    leftLink,
    rightLink,
    hideSocialButtons = false
  }: {
    title: string;
    description: string;
    children: Snippet;
    leftLink: { href: string; text: string };
    rightLink?: { text: string; linkText: string; href: string };
    hideSocialButtons?: boolean;
  } = $props();
</script>

<div class="flex flex-1 items-center justify-center px-4 py-16">
  <div class="w-full max-w-md">
    <Card.Root>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        {#if !hideSocialButtons}
          <!-- Social buttons placeholder - implement OAuth buttons as needed -->
          <div class="grid grid-cols-2 gap-2">
            <a
              href="/auth/signin/google"
              class="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            >
              Google
            </a>
            <a
              href="/auth/signin/github"
              class="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            >
              GitHub
            </a>
          </div>

          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t"></span>
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background text-muted-foreground px-2">Or continue with</span>
            </div>
          </div>
        {/if}

        {@render children()}

        <div class="flex items-center justify-between text-sm">
          <a href={leftLink.href} class="text-primary hover:text-primary/90 hover:underline">
            {leftLink.text}
          </a>
          {#if rightLink}
            <div>
              <span class="text-muted-foreground">{rightLink.text} </span>
              <a
                href={rightLink.href}
                class="text-primary hover:text-primary/90 font-medium hover:underline"
              >
                {rightLink.linkText}
              </a>
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  </div>
</div>
