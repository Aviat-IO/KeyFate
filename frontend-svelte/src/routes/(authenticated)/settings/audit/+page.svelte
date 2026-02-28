<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';

  let { data } = $props();
</script>

<svelte:head>
  <title>Audit Logs - KeyFate</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold tracking-tight">Audit Logs</h2>
    <p class="text-muted-foreground">
      {data.userTier === 'pro'
        ? 'Comprehensive audit trail of all activities in your account'
        : 'Comprehensive audit trails are a Pro feature'}
    </p>
  </div>

  {#if data.userTier !== 'pro'}
    <Card.Root>
      <Card.Header>
        <Card.Title>Audit Logs</Card.Title>
        <Card.Description>Comprehensive audit trails are a Pro feature</Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="space-y-4">
          <p class="text-muted-foreground">
            Upgrade to Pro to access comprehensive audit logs that track all activities in your
            account, including:
          </p>
          <ul class="text-muted-foreground list-inside list-disc space-y-2">
            <li>Secret creation, editing, and deletion</li>
            <li>Check-in activity</li>
            <li>Recipient management</li>
            <li>Login events</li>
            <li>Subscription changes</li>
            <li>Settings updates</li>
          </ul>
          <div class="flex gap-4 pt-4">
            <Button href="/pricing">Upgrade to Pro</Button>
            <Button variant="outline" href="/dashboard">Back to Dashboard</Button>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Stub: AuditLogsPage component will be rendered here -->
    <p class="text-muted-foreground">The AuditLogsPage component is being ported.</p>
  {/if}
</div>
