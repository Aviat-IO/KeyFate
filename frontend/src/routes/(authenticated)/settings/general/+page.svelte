<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>General Settings - KeyFate</title>
</svelte:head>

<div class="space-y-8">
	<div>
		<h2 class="font-space text-xl font-bold tracking-tight">General Settings</h2>
		<p class="text-muted-foreground mt-1 text-sm">View your account information</p>
	</div>

	<div class="space-y-6">
		<div>
			<span class="text-muted-foreground text-xs font-medium">Name</span>
			<p class="text-foreground mt-1 text-base">{data.user.name}</p>
		</div>
		<div>
			<span class="text-muted-foreground text-xs font-medium">Email</span>
			<p class="text-foreground mt-1 text-base">{data.user.email}</p>
		</div>
		<div>
			<span class="text-muted-foreground text-xs font-medium">Joined</span>
			<p class="text-foreground mt-1 text-base">{data.user.joinDate}</p>
		</div>
	</div>
</div>
