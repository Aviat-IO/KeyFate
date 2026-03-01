<script lang="ts">
  import { goto } from '$app/navigation';
  import DeleteConfirm from '$lib/components/DeleteConfirm.svelte';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { AlertCircle, Plus, Trash2 } from '@lucide/svelte';

  let {
    initialData,
    secretId,
    isPaid = false
  }: {
    initialData: {
      title: string;
      recipients: Array<{ name: string; email?: string | null; phone?: string | null }>;
      check_in_days: number;
    };
    secretId: string;
    isPaid?: boolean;
  } = $props();

  let loading = $state(false);
  let error = $state<string | null>(null);
  let deleteLoading = $state(false);
  let showDeleteModal = $state(false);

  let title = $state(initialData.title);
  let recipients = $state(
    initialData.recipients.map((r) => ({
      name: r.name,
      email: r.email || '',
      phone: r.phone || ''
    }))
  );
  let checkInDays = $state(initialData.check_in_days);

  function addRecipient() {
    recipients = [...recipients, { name: '', email: '', phone: '' }];
  }

  function removeRecipient(index: number) {
    recipients = recipients.filter((_, i) => i !== index);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    loading = true;
    error = null;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secretId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({ title, recipients, check_in_days: checkInDays })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update secret');
      }

      goto('/dashboard');
    } catch (err) {
      console.error('Error updating secret:', err);
      error = err instanceof Error ? err.message : 'Failed to update secret';
    } finally {
      loading = false;
    }
  }

  async function handleDelete() {
    deleteLoading = true;
    error = null;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token: csrfToken } = await csrfRes.json();

      const response = await fetch(`/api/secrets/${secretId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete secret');
      }

      showDeleteModal = false;
      goto('/dashboard');
    } catch (err) {
      console.error('Error deleting secret:', err);
      error = err instanceof Error ? err.message : 'Failed to delete secret';
      showDeleteModal = false;
    } finally {
      deleteLoading = false;
    }
  }
</script>

{#if error}
  <Alert.Root variant="destructive" class="mb-6">
    <AlertCircle class="h-4 w-4" />
    <Alert.Description>{error}</Alert.Description>
  </Alert.Root>
{/if}

<form onsubmit={handleSubmit} class="space-y-8">
  <div class="space-y-4">
    <div class="space-y-2">
      <Label for="title" class="text-xs font-medium text-muted-foreground">Secret Title</Label>
      <Input id="title" bind:value={title} placeholder="Example: Important Documents Location" />
    </div>
  </div>

  <!-- Recipients -->
  <div class="space-y-4 pt-8">
    <div class="flex items-center justify-between">
      <h2 class="font-space text-lg font-bold tracking-tight">Recipients</h2>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onclick={addRecipient}
        disabled={loading}
        class="h-8 gap-1.5 text-xs"
      >
        <Plus class="h-3 w-3" />
        Add Recipient
      </Button>
    </div>
    <div class="space-y-3">
      {#each recipients as recipient, index}
        <div class="space-y-3 rounded-md border border-border/50 p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium text-muted-foreground">Recipient {index + 1}</div>
            {#if recipients.length > 1}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => removeRecipient(index)}
                disabled={loading}
                class="h-7 w-7 p-0"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            {/if}
          </div>

          <div class="space-y-2">
            <Label class="text-xs font-medium text-muted-foreground">Name</Label>
            <Input bind:value={recipient.name} placeholder="Recipient's name" class="h-9" />
          </div>

          <div class="space-y-2">
            <Label class="text-xs font-medium text-muted-foreground">Email</Label>
            <Input
              type="email"
              bind:value={recipient.email}
              placeholder="recipient@example.com"
              class="h-9"
            />
          </div>

          <div class="space-y-2">
            <Label class="text-xs font-medium text-muted-foreground">Phone (optional)</Label>
            <Input type="tel" bind:value={recipient.phone} placeholder="+1234567890" class="h-9" />
            <p class="text-muted-foreground text-xs">Phone notifications are not yet supported</p>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Check-in Settings -->
  <div class="space-y-4 pt-8">
    <h2 class="font-space text-lg font-bold tracking-tight">Check-in Settings</h2>
    <div class="space-y-2">
      <Label for="checkInDays" class="text-xs font-medium text-muted-foreground">Trigger Deadline</Label>
      {#if isPaid}
        <Input
          id="checkInDays"
          type="number"
          bind:value={checkInDays}
          min={2}
          max={365}
          disabled={loading}
          placeholder="Enter custom days"
        />
      {:else}
        <Select.Root type="single" value={String(checkInDays)} onValueChange={(v) => (checkInDays = Number(v))}>
          <Select.Trigger>
            <span>{checkInDays} days</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="2">Daily</Select.Item>
            <Select.Item value="7">Weekly</Select.Item>
            <Select.Item value="14">Every 2 weeks</Select.Item>
            <Select.Item value="30">Monthly</Select.Item>
            <Select.Item value="90">Every 3 months</Select.Item>
            <Select.Item value="180">Every 6 months</Select.Item>
            <Select.Item value="365">Yearly</Select.Item>
          </Select.Content>
        </Select.Root>
      {/if}
      <p class="text-muted-foreground text-xs">
        {isPaid
          ? 'How long until your secret is automatically disclosed. Minimum 2 days.'
          : 'How long until your secret is automatically disclosed. Upgrade to set custom intervals.'}
      </p>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="flex flex-col justify-between space-y-3 pt-6 sm:flex-row sm:space-x-4 sm:space-y-0">
    <Button
      type="button"
      variant="destructive"
      onclick={() => (showDeleteModal = true)}
      disabled={loading || deleteLoading}
      class="w-full sm:w-auto font-semibold"
    >
      Delete Secret
    </Button>
    <div class="flex flex-col space-y-3 sm:flex-row sm:space-x-4 sm:space-y-0">
      <Button
        type="button"
        variant="outline"
        onclick={() => history.back()}
        disabled={loading || deleteLoading}
        class="w-full sm:w-auto font-semibold"
        data-testid="form-cancel-button"
      >
        Cancel
      </Button>
      <Button type="submit" disabled={loading || deleteLoading} class="w-full sm:w-auto font-semibold">
        {loading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  </div>
</form>

<DeleteConfirm
  bind:open={showDeleteModal}
  onOpenChange={(v) => (showDeleteModal = v)}
  onConfirm={handleDelete}
  title="Delete Secret"
  description="Are you sure you want to delete this secret? This action cannot be undone and the secret will be permanently removed."
  confirmText="Delete Secret"
  loading={deleteLoading}
/>
