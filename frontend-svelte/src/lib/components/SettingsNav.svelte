<script lang="ts">
  import { cn } from '$lib/utils';
  import { CreditCard, FileText, User, Shield } from '@lucide/svelte';
  import { page } from '$app/stores';
  import type { Component } from 'svelte';

  let { isProUser }: { isProUser: boolean } = $props();

  const pathname = $derived($page.url.pathname);

  interface NavLink {
    href: string;
    label: string;
    icon: Component<{ class?: string }>;
  }

  const links = $derived<NavLink[]>([
    { href: '/settings/general', label: 'General', icon: User },
    { href: '/settings/privacy', label: 'Data & Privacy', icon: Shield },
    ...(isProUser ? [{ href: '/settings/audit', label: 'Audit Logs', icon: FileText }] : []),
    { href: '/settings/subscription', label: 'Subscription', icon: CreditCard }
  ]);
</script>

<nav class="space-y-1">
  {#each links as link}
    {@const Icon = link.icon}
    {@const isActive = pathname === link.href}
    <a
      href={link.href}
      class={cn(
        'flex items-center gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
        isActive
          ? 'text-foreground border-l-2 border-foreground'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon class="h-4 w-4" />
      {link.label}
    </a>
  {/each}
</nav>
