<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Progress } from '$lib/components/ui/progress';
  import { CircleAlert, Crown } from '@lucide/svelte';

  let {
    tier,
    secretsUsed,
    secretsLimit,
    canCreateMore
  }: {
    tier: 'free' | 'pro';
    secretsUsed: number;
    secretsLimit: number;
    canCreateMore: boolean;
  } = $props();

  const percentageUsed = $derived((secretsUsed / secretsLimit) * 100);
  const isAtLimit = $derived(secretsUsed >= secretsLimit);

  const progressColor = $derived(
    percentageUsed >= 100
      ? 'bg-destructive'
      : percentageUsed >= 90
        ? 'bg-destructive/80'
        : percentageUsed >= 75
          ? 'bg-muted-foreground'
          : ''
  );
</script>

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between">
      <Card.Title class="text-lg">Your Plan</Card.Title>
      <Badge variant={tier === 'pro' ? 'default' : 'outline'} class="gap-1">
        {#if tier === 'pro'}
          <Crown class="h-3 w-3" />
        {/if}
        {tier === 'free' ? 'Free' : 'Pro'}
      </Badge>
    </div>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div>
      <div class="mb-2 flex items-center justify-between text-sm">
        <span class="text-muted-foreground">Secrets Used</span>
        <span class="font-medium">{secretsUsed} of {secretsLimit}</span>
      </div>
      <Progress value={percentageUsed} class="h-2" />
    </div>

    {#if isAtLimit}
      <Alert.Root>
        <CircleAlert class="h-4 w-4" />
        <Alert.Description>
          You've reached your {tier === 'free' ? 'free tier' : 'plan'} limit.
          {#if tier === 'free'}
            {' '}Upgrade to Pro to create more secrets.
          {/if}
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if tier === 'free'}
      <div class="space-y-2">
        <div class="text-muted-foreground text-sm">Upgrade to Pro for:</div>
        <ul class="ml-4 space-y-1 text-sm">
          <li>• 10 secrets (vs 1)</li>
          <li>• 5 recipients per secret</li>
          <li>• Custom check-in intervals</li>
          <li>• Message templates</li>
        </ul>
        <Button href="/pricing" class="mt-4 w-full">
          <Crown class="mr-2 h-4 w-4" />
          Upgrade to Pro
        </Button>
      </div>
    {/if}

    {#if tier === 'pro' && canCreateMore}
      <div class="text-muted-foreground pt-2 text-center text-sm">
        You can create {secretsLimit - secretsUsed} more secret{secretsLimit - secretsUsed === 1
          ? ''
          : 's'}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
