<script lang="ts">
  import { page } from '$app/stores';
  import { Separator } from '$lib/components/ui/separator';

  let { children } = $props();

  let pathname = $derived($page.url.pathname);

  const navItems = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/subscription', label: 'Subscription' },
    { href: '/settings/privacy', label: 'Data & Privacy' },
    { href: '/settings/audit', label: 'Audit Logs' },
  ];
</script>

<div class="mx-auto py-8 sm:px-4">
  <div class="grid grid-cols-1 gap-6 md:grid-cols-[200px_1px_1fr]">
    <aside class="md:col-span-1">
      <nav class="flex flex-col space-y-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground {pathname ===
            item.href
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground'}"
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </aside>
    <Separator orientation="vertical" class="hidden h-auto md:block" />
    <main class="md:col-span-1">
      {@render children()}
    </main>
  </div>
</div>
