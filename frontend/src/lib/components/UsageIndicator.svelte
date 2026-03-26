<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { Progress } from '$lib/components/ui/progress';

  // Temporarily disabled during migration
  const user = null as null | { id: string };
  const secretCount = 0;
  const loading = false;

  const maxSecrets = 3;
  const usagePercentage = $derived((secretCount / maxSecrets) * 100);
</script>

{#if loading}
  <Card.Root class="border-0 shadow-none bg-transparent">
    <Card.Content class="p-6">
      <div class="animate-pulse space-y-4">
        <div class="bg-muted h-4 w-3/4 rounded"></div>
        <div class="bg-muted h-4 w-full rounded"></div>
      </div>
    </Card.Content>
  </Card.Root>
{:else if user}
  <Card.Root class="border-0 shadow-none bg-transparent">
    <Card.Header>
      <Card.Title class="font-space flex items-center justify-between">
        Usage
        <Badge variant={usagePercentage >= 100 ? 'destructive' : 'secondary'}>
          {secretCount}/{maxSecrets}
        </Badge>
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <div class="flex justify-between text-sm">
          <span>Secrets</span>
          <span>{secretCount} of {maxSecrets}</span>
        </div>
        <Progress value={usagePercentage} class="h-2" />
      </div>

      {#if usagePercentage >= 80}
        <div class="text-muted-foreground text-sm">
          {#if usagePercentage >= 100}
            You've reached your limit. Upgrade to create more secrets.
          {:else}
            You're approaching your limit. Consider upgrading soon.
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
