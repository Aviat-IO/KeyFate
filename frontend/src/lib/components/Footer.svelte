<script lang="ts">
	const supportEmail = 'support@keyfate.com';
</script>

<footer class="border-border/50 bg-background mt-16 border-t px-6 py-12">
	<div class="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 md:flex-row">
		<div class="flex items-center gap-2">
			<img
				src="/img/icon-light-32.png"
				alt="KeyFate"
				width="32"
				height="32"
				class="block h-8 w-8 dark:hidden"
			/>
			<img
				src="/img/icon-dark-32.png"
				alt="KeyFate"
				width="32"
				height="32"
				class="hidden h-8 w-8 dark:block"
			/>
			<span class="font-space font-bold">KeyFate</span>
		</div>

		<div class="text-muted-foreground flex flex-wrap items-center justify-center gap-8 text-xs">
			<a href="/faq" class="hover:text-foreground transition-colors">FAQ</a>
			<a href="/pricing" class="hover:text-foreground transition-colors">Pricing</a>
			<a href="/blog" class="hover:text-foreground transition-colors">Blog</a>
			<a href="/privacy-policy" class="hover:text-foreground transition-colors">Privacy</a>
			<a href="/terms-of-service" class="hover:text-foreground transition-colors">Terms</a>
			<a href="mailto:{supportEmail}" class="hover:text-foreground transition-colors"> Contact </a>
			<a
				href="https://github.com/Aviat-IO/keyfate"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-foreground transition-colors"
			>
				GitHub
			</a>
		</div>

		<p class="text-muted-foreground/50 text-xs">Zero-knowledge security. Open source.</p>
	</div>
</footer>
