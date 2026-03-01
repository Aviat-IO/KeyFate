<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>General Settings - KeyFate</title>
</svelte:head>

<div class="space-y-8">
  <div>
    <h2 class="font-space text-xl font-bold tracking-tight">General Settings</h2>
    <p class="text-sm text-muted-foreground mt-1">View your account information</p>
  </div>

  <div class="space-y-6">
    <div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Name</span>
      <p class="text-base text-foreground mt-1">{data.user.name}</p>
    </div>
    <div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Email</span>
      <p class="text-base text-foreground mt-1">{data.user.email}</p>
    </div>
    <div>
      <span class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Joined</span>
      <p class="text-base text-foreground mt-1">{data.user.joinDate}</p>
    </div>
  </div>
</div>
