<script lang="ts">
  import ContactMethodsForm from '$lib/components/ContactMethodsForm.svelte';
  import * as Dialog from '$lib/components/ui/dialog';

  let {
    open = $bindable(false),
    onOpenChange,
    onSubmit
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (methods: any) => Promise<void>;
  } = $props();
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Set Up Contact Methods</Dialog.Title>
      <Dialog.Description>
        Please provide at least one way for us to contact you for check-ins. This information will
        be saved for future use.
      </Dialog.Description>
    </Dialog.Header>
    <ContactMethodsForm
      onSubmit={async (methods) => {
        await onSubmit(methods);
        onOpenChange(false);
      }}
      submitLabel="Continue"
    />
  </Dialog.Content>
</Dialog.Root>
