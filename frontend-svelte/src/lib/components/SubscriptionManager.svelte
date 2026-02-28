<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  // Temporarily disabled during migration
  const loading = false;
  const user = null as null | { id: string };
</script>

{#if loading}
  <Card.Root>
    <Card.Content class="p-6">
      <div class="animate-pulse space-y-4">
        <div class="bg-muted h-4 w-3/4 rounded"></div>
        <div class="bg-muted h-10 w-full rounded"></div>
      </div>
    </Card.Content>
  </Card.Root>
{:else if user}
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center justify-between">
        Subscription
        <Badge>Free</Badge>
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <p class="text-sm"><strong>Plan:</strong> Free</p>
        <p class="text-sm"><strong>Status:</strong> Active</p>
      </div>

      <div class="space-y-2">
        <Button class="w-full">Upgrade to Pro</Button>
        <Button variant="outline" class="w-full">View Billing History</Button>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
