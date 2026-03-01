<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { AlertTriangle } from '@lucide/svelte';

  let {
    open = $bindable(false),
    onOpenChange,
    onConfirm,
    title = 'Are you absolutely sure?',
    description = 'This action cannot be undone. This will permanently delete this item.',
    confirmText = 'Delete',
    cancelText = 'Cancel',
    loading = false
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
  } = $props();
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <div class="flex items-start gap-3">
        <div
          class="bg-destructive/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        >
          <AlertTriangle class="text-destructive h-6 w-6" />
        </div>
        <div class="min-w-0 flex-1">
          <Dialog.Title class="text-left">{title}</Dialog.Title>
          <Dialog.Description class="mt-1 text-left">{description}</Dialog.Description>
        </div>
      </div>
    </Dialog.Header>
    <Dialog.Footer class="gap-2 sm:justify-start">
      <Button type="button" variant="outline" onclick={() => onOpenChange(false)} disabled={loading} class="uppercase tracking-wide">
        {cancelText}
      </Button>
      <Button type="button" variant="destructive" onclick={onConfirm} disabled={loading} class="uppercase tracking-wide">
        {loading ? 'Deleting...' : confirmText}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
