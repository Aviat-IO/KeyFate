<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Moon, Sun } from 'lucide-svelte';
  import { browser } from '$app/environment';

  let theme = $state<'light' | 'dark'>('light');

  function getInitialTheme(): 'light' | 'dark' {
    if (!browser) return 'light';
    if (document.documentElement.classList.contains('dark')) return 'dark';
    return 'light';
  }

  $effect(() => {
    theme = getInitialTheme();
  });

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    if (browser) {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }
</script>

<Button variant="ghost" size="icon" onclick={toggleTheme}>
  {#if theme === 'light'}
    <Moon class="h-[1.2rem] w-[1.2rem]" />
  {:else}
    <Sun class="h-[1.2rem] w-[1.2rem]" />
  {/if}
  <span class="sr-only">Toggle theme</span>
</Button>
