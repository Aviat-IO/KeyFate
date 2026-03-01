<script lang="ts">
  import { page } from '$app/stores';
  import { signOut } from '@auth/sveltekit/client';
  import { Button } from '$lib/components/ui/button';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { Crown, LogOut, Menu, Settings, X } from 'lucide-svelte';

  let { session = null }: { session?: any } = $props();

  let pathname = $derived($page.url.pathname);
  let user = $derived(session?.user);

  let userTier = $state<'free' | 'pro'>('free');
  let mobileMenuOpen = $state(false);

  $effect(() => {
    if (!user?.id) return;
    fetch('/api/user/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) userTier = data.tier?.name === 'pro' ? 'pro' : 'free';
      })
      .catch(() => {});
  });

  let isProUser = $derived(userTier === 'pro');

  function handleSignOut() {
    signOut({ callbackUrl: '/auth/signin' });
  }

  const menuItemClass =
    'flex select-none items-center gap-2 rounded-md px-3 py-2 text-xs font-medium leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground';

  function isActive(path: string, exact = true) {
    return exact ? pathname === path : pathname.startsWith(path);
  }
</script>

<nav
  class="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b border-border/50 backdrop-blur"
>
  <div class="mx-auto max-w-5xl px-6">
    <div class="flex h-16 items-center justify-between">
      <div class="flex items-center space-x-4">
        <a href={user ? '/dashboard' : '/'} class="flex items-center">
          <!-- Mobile icons -->
          <img
            src="/img/icon-light.png"
            alt="KeyFate"
            width="40"
            height="40"
            class="block h-10 w-10 sm:hidden dark:hidden"
          />
          <img
            src="/img/icon-dark.png"
            alt="KeyFate"
            width="40"
            height="40"
            class="hidden h-10 w-10 dark:block dark:sm:hidden"
          />
          <!-- Desktop logos -->
          <img
            src="/img/logo-light.png"
            alt="KeyFate"
            width="200"
            height="40"
            class="hidden h-10 w-auto sm:block dark:sm:hidden"
          />
          <img
            src="/img/logo-dark.png"
            alt="KeyFate"
            width="200"
            height="40"
            class="hidden h-10 w-auto dark:sm:block"
          />
        </a>

        <div class="hidden items-center space-x-1 md:flex">
          {#if user}
            <a
              href="/dashboard"
              class="rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
                '/dashboard'
              )
                ? 'bg-accent text-accent-foreground'
                : ''}"
            >
              Dashboard
            </a>
          {/if}

          {#if !user}
            <a
              href="/pricing"
              class="rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
                '/pricing'
              )
                ? 'bg-accent text-accent-foreground'
                : ''}"
            >
              Pricing
            </a>
          {/if}

          <a
            href="/blog"
            class="rounded-md px-3 py-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground {isActive(
              '/blog',
              false
            )
              ? 'bg-accent text-accent-foreground'
              : ''}"
          >
            Blog
          </a>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          href="/decrypt"
          class="hidden md:flex {isActive('/decrypt')
            ? 'bg-accent text-accent-foreground'
            : ''}"
        >
          Recover Secret
        </Button>

        <ThemeToggle />

        {#if isProUser}
          <Button
            variant="outline"
            size="sm"
            class="border-primary text-primary hover:bg-primary hover:text-primary-foreground hidden md:flex"
          >
            <Crown class="h-4 w-4" />
            Pro
          </Button>
        {/if}

        {#if !user}
          <Button variant="ghost" size="sm" href="/auth/signin" class="hidden md:flex">
            Sign In
          </Button>
          <Button variant="default" size="sm" href="/auth/signin" class="">Sign Up</Button>
        {/if}

        {#if user}
          <!-- Desktop account dropdown -->
          <div class="relative hidden md:block">
            <Button
              variant="ghost"
              size="sm"
              class=""
              onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
            >
              Account
            </Button>
            {#if mobileMenuOpen}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <div
                class="fixed inset-0 z-40"
                onclick={() => (mobileMenuOpen = false)}
              ></div>
              <div
                class="absolute right-0 z-50 mt-2 w-[200px] rounded-md border bg-popover p-2 shadow-md"
              >
                <a
                  href="/settings"
                  class="{menuItemClass} {isActive('/settings')
                    ? 'bg-accent text-accent-foreground'
                    : ''}"
                  onclick={() => (mobileMenuOpen = false)}
                >
                  <Settings class="h-4 w-4" />
                  <span>Settings</span>
                </a>
                {#if !isProUser}
                  <a
                    href="/pricing"
                    class="{menuItemClass} {isActive('/pricing')
                      ? 'bg-accent text-accent-foreground'
                      : ''}"
                    onclick={() => (mobileMenuOpen = false)}
                  >
                    <Crown class="h-4 w-4" />
                    <span>Upgrade to Pro</span>
                  </a>
                {/if}
                <button class="{menuItemClass} w-full text-left" onclick={handleSignOut}>
                  <LogOut class="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Mobile menu button -->
        <Button
          variant="ghost"
          size="icon"
          class="md:hidden"
          onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
          data-testid="mobile-menu-trigger"
        >
          {#if mobileMenuOpen}
            <X class="h-5 w-5" />
          {:else}
            <Menu class="h-5 w-5" />
          {/if}
          <span class="sr-only">Open menu</span>
        </Button>
      </div>
    </div>

    <!-- Mobile menu -->
    {#if mobileMenuOpen}
      <div class="border-t pb-4 md:hidden" data-testid="dropdown-content">
        <div class="space-y-1 pt-2">
          {#if !user}
            <a
              href="/pricing"
              class="{menuItemClass} {isActive('/pricing')
                ? 'bg-accent text-accent-foreground'
                : ''}"
              onclick={() => (mobileMenuOpen = false)}
            >
              Pricing
            </a>
          {/if}

          {#if user}
            <a
              href="/dashboard"
              class="{menuItemClass} {isActive('/dashboard')
                ? 'bg-accent text-accent-foreground'
                : ''}"
              onclick={() => (mobileMenuOpen = false)}
            >
              Dashboard
            </a>
            <a
              href="/settings"
              class="{menuItemClass} {isActive('/settings')
                ? 'bg-accent text-accent-foreground'
                : ''}"
              onclick={() => (mobileMenuOpen = false)}
            >
              <Settings class="h-4 w-4" />
              Settings
            </a>
          {/if}

          <a
            href="/decrypt"
            class="{menuItemClass} {isActive('/decrypt')
              ? 'bg-accent text-accent-foreground'
              : ''}"
            data-testid="mobile-recover-secret"
            onclick={() => (mobileMenuOpen = false)}
          >
            Recover Secret
          </a>

          {#if user}
            {#if !isProUser}
              <a
                href="/pricing"
                class="{menuItemClass} {isActive('/pricing')
                  ? 'bg-accent text-accent-foreground'
                  : ''}"
                onclick={() => (mobileMenuOpen = false)}
              >
                <Crown class="h-4 w-4" />
                Upgrade to Pro
              </a>
            {/if}
            <button class="{menuItemClass} w-full text-left" onclick={handleSignOut}>
              <LogOut class="h-4 w-4" />
              Sign Out
            </button>
          {/if}

          {#if !user}
            <a
              href="/auth/signin"
              class={menuItemClass}
              onclick={() => (mobileMenuOpen = false)}
            >
              Sign In
            </a>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</nav>
