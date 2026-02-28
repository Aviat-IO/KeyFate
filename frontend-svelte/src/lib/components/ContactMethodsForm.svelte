<script lang="ts">
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { AlertCircle } from '@lucide/svelte';

  interface ContactMethods {
    email: string;
    phone: string;
    telegram_username: string;
    whatsapp: string;
    signal: string;
    preferred_method: string;
    check_in_days: number;
  }

  let {
    onSubmit,
    initialValues,
    submitLabel = 'Save Changes',
    showCancel = false,
    onCancel
  }: {
    onSubmit: (methods: ContactMethods) => Promise<void>;
    initialValues?: ContactMethods | null;
    submitLabel?: string;
    showCancel?: boolean;
    onCancel?: () => void;
  } = $props();

  const defaults: ContactMethods = {
    email: '',
    phone: '',
    telegram_username: '',
    whatsapp: '',
    signal: '',
    preferred_method: 'email',
    check_in_days: 90
  };

  let formData = $state<ContactMethods>(initialValues || defaults);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    isLoading = true;
    error = null;

    try {
      await onSubmit(formData);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save contact methods';
    } finally {
      isLoading = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') e.preventDefault();
  }
</script>

<div>
  <form onsubmit={handleSubmit} class="space-y-6">
    {#if error}
      <Alert.Root variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <Alert.Description>{error}</Alert.Description>
      </Alert.Root>
    {/if}

    <div class="space-y-2">
      <Label>Email</Label>
      <Input
        type="email"
        placeholder="Your email address"
        bind:value={formData.email}
        onkeydown={handleKeyDown}
      />
    </div>

    <div class="space-y-2">
      <Label>Phone</Label>
      <Input
        type="tel"
        placeholder="Your phone number"
        bind:value={formData.phone}
        onkeydown={handleKeyDown}
      />
    </div>

    <div class="space-y-2">
      <Label>Telegram Username</Label>
      <Input
        type="text"
        placeholder="Your telegram username"
        bind:value={formData.telegram_username}
        onkeydown={handleKeyDown}
      />
    </div>

    <div class="space-y-2">
      <Label>WhatsApp</Label>
      <Input
        type="tel"
        placeholder="Your whatsapp number"
        bind:value={formData.whatsapp}
        onkeydown={handleKeyDown}
      />
    </div>

    <div class="space-y-2">
      <Label>Signal</Label>
      <Input
        type="tel"
        placeholder="Your signal number"
        bind:value={formData.signal}
        onkeydown={handleKeyDown}
      />
    </div>

    <div class="space-y-2">
      <Label>Preferred Contact Method</Label>
      <Select.Root type="single" bind:value={formData.preferred_method}>
        <Select.Trigger>
          <span>{formData.preferred_method}</span>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="email">Email</Select.Item>
          <Select.Item value="phone">Phone</Select.Item>
          <Select.Item value="both">Both Email and Phone</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>

    <div class="space-y-2">
      <Label>Check-in Days</Label>
      <Input type="number" bind:value={formData.check_in_days} onkeydown={handleKeyDown} />
    </div>

    <div class="flex justify-end space-x-4">
      {#if showCancel}
        <Button type="button" variant="outline" onclick={onCancel}>Cancel</Button>
      {/if}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : submitLabel}
      </Button>
    </div>
  </form>
</div>
