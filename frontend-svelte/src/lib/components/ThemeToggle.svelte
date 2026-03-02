<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Moon, Sun } from '@lucide/svelte';
  import { toggleMode, mode } from 'mode-watcher';
</script>

<Button variant="ghost" size="icon" onclick={toggleMode}>
  {#if mode.current === 'dark'}
    <Sun class="h-[1.2rem] w-[1.2rem]" />
  {:else}
    <Moon class="h-[1.2rem] w-[1.2rem]" />
  {/if}
  <span class="sr-only">Toggle theme</span>
</Button>
