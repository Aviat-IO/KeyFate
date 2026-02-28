<script lang="ts">
  import * as Card from '$lib/components/ui/card';

  let { data } = $props();
</script>

<svelte:head>
  <title>General Settings - KeyFate</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold tracking-tight">General Settings</h2>
    <p class="text-muted-foreground">View your account information</p>
  </div>

  <Card.Root>
    <Card.Header>
      <Card.Title>Account Information</Card.Title>
      <Card.Description>Your KeyFate account details</Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div>
        <label class="text-muted-foreground text-sm font-medium">Name</label>
        <p class="text-lg">{data.user.name}</p>
      </div>
      <div>
        <label class="text-muted-foreground text-sm font-medium">Email</label>
        <p class="text-lg">{data.user.email}</p>
      </div>
      <div>
        <label class="text-muted-foreground text-sm font-medium">Joined</label>
        <p class="text-lg">{data.user.joinDate}</p>
      </div>
    </Card.Content>
  </Card.Root>
</div>
