<script lang="ts">
	let { progress = 0, class: className = '' }: { progress: number; class?: string } = $props();

	let clampedProgress = $derived(Math.max(0, Math.min(100, progress)));
</script>

<div class="bg-muted relative my-8 h-[2px] w-full {className}">
	<div
		class="bg-primary absolute top-0 left-0 h-full transition-all duration-1000"
		style="width: {clampedProgress}%"
	></div>
	<div
		class="border-primary bg-background absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 transition-all duration-1000"
		style="left: {clampedProgress}%"
	></div>
</div>
