<script lang="ts">
  const supportEmail = 'support@keyfate.com';
</script>

<footer class="mt-16 border-t border-border/50 bg-background px-6 py-12">
  <div
    class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row"
  >
    <div class="flex items-center gap-2">
      <img
        src="/img/icon-light.png"
        alt="KeyFate"
        width="32"
        height="32"
        class="block h-8 w-8 dark:hidden"
      />
      <img
        src="/img/icon-dark.png"
        alt="KeyFate"
        width="32"
        height="32"
        class="hidden h-8 w-8 dark:block"
      />
      <span class="font-space font-bold">KeyFate</span>
    </div>

    <div
      class="flex flex-wrap items-center justify-center gap-8 text-xs text-muted-foreground"
    >
      <a href="/faq" class="transition-colors hover:text-foreground">FAQ</a>
      <a href="/pricing" class="transition-colors hover:text-foreground">Pricing</a>
      <a href="/blog" class="transition-colors hover:text-foreground">Blog</a>
      <a href="/privacy-policy" class="transition-colors hover:text-foreground">Privacy</a>
      <a href="/terms-of-service" class="transition-colors hover:text-foreground">Terms</a>
      <a
        href="mailto:{supportEmail}"
        class="transition-colors hover:text-foreground"
      >
        Contact
      </a>
      <a
        href="https://github.com/Aviat-IO/keyfate"
        target="_blank"
        rel="noopener noreferrer"
        class="transition-colors hover:text-foreground"
      >
        GitHub
      </a>
    </div>

    <p class="text-xs text-muted-foreground/50">Zero-knowledge security. Open source.</p>
  </div>
</footer>
