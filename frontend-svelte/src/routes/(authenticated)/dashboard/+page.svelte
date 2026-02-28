<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  // Stub: SecretsGrid and UpgradeSuccessDialog will be ported separately
  // For now, show a placeholder dashboard
</script>

<svelte:head>
  <title>Dashboard - KeyFate</title>
</svelte:head>

<div class="container mx-auto py-8 sm:px-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-3xl font-bold">Your Secrets</h1>
    <Button variant="outline" href="/secrets/new">Create New Secret</Button>
  </div>

  <!-- Stub: SecretsGrid component will be rendered here -->
  <div class="mx-auto max-w-2xl">
    <Card.Root>
      <Card.Header>
        <Card.Title>Dashboard</Card.Title>
      </Card.Header>
      <Card.Content>
        <p class="text-muted-foreground mb-4">
          Your secrets will appear here. The SecretsGrid component is being ported.
        </p>
        <Button href="/secrets/new">Create Your First Secret</Button>
      </Card.Content>
    </Card.Root>
  </div>
</div>
