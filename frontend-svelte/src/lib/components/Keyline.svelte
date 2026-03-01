<script lang="ts">
  let { progress = 0, class: className = '' }: { progress: number; class?: string } = $props();

  let clampedProgress = $derived(Math.max(0, Math.min(100, progress)));
</script>

<div class="relative my-8 h-[2px] w-full bg-muted {className}">
  <div
    class="absolute left-0 top-0 h-full bg-primary transition-all duration-1000"
    style="width: {clampedProgress}%"
  ></div>
  <div
    class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background transition-all duration-1000"
    style="left: {clampedProgress}%"
  ></div>
</div>
