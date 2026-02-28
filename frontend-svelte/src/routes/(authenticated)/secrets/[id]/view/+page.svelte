<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { ArrowLeft, FileText } from 'lucide-svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>View Secret - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-4xl py-8 sm:px-4">
  <div class="mb-6 flex items-center gap-4">
    <a href="/dashboard">
      <Button variant="ghost" size="icon">
        <ArrowLeft class="h-4 w-4" />
      </Button>
    </a>
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold">
        <FileText class="text-primary h-8 w-8" />
        Secret Details
      </h1>
      <p class="text-muted-foreground">Secret ID: {data.secretId}</p>
    </div>
  </div>

  <!-- Stub: Full secret view will be implemented when DB operations are ported -->
  <Card.Root>
    <Card.Header>
      <Card.Title>Secret View</Card.Title>
    </Card.Header>
    <Card.Content>
      <p class="text-muted-foreground">
        The full secret view page is being ported. It will display secret information, status,
        recipients, check-in history, and actions.
      </p>
    </Card.Content>
  </Card.Root>
</div>
