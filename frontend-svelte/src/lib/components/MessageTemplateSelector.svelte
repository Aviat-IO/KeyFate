<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import {
    MESSAGE_TEMPLATES,
    type MessageTemplate,
    getAllCategories
  } from '$lib/constants/message-templates';
  import { Crown, FileText } from '@lucide/svelte';

  let {
    onSelectTemplate,
    isPro,
    onUpgradeClick
  }: {
    onSelectTemplate: (content: string) => void;
    isPro: boolean;
    onUpgradeClick?: () => void;
  } = $props();

  let open = $state(false);
  let selectedCategory = $state<string | null>(null);

  const categories = getAllCategories();
  let filteredTemplates = $derived(
    selectedCategory
      ? MESSAGE_TEMPLATES.filter((t) => t.category === selectedCategory)
      : MESSAGE_TEMPLATES
  );

  function handleSelectTemplate(template: MessageTemplate) {
    onSelectTemplate(template.content);
    open = false;
  }
</script>

{#if !isPro}
  <Button type="button" variant="outline" onclick={onUpgradeClick} class="w-full gap-2">
    <Crown class="h-4 w-4" />
    Message Templates (Pro)
  </Button>
{:else}
  <Dialog.Root bind:open>
    <Dialog.Trigger>
      {#snippet child({ props })}
        <Button type="button" variant="outline" class="w-full gap-2" {...props}>
          <FileText class="h-4 w-4" />
          Use Message Template
        </Button>
      {/snippet}
    </Dialog.Trigger>
    <Dialog.Content class="max-h-[80vh] sm:max-w-[700px]">
      <Dialog.Header>
        <Dialog.Title>Message Templates</Dialog.Title>
        <Dialog.Description>
          Choose a pre-written template to customize for your secret
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onclick={() => (selectedCategory = null)}
          >
            All
          </Button>
          {#each categories as category}
            <Button
              type="button"
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onclick={() => (selectedCategory = category)}
            >
              {category}
            </Button>
          {/each}
        </div>

        <ScrollArea class="h-[400px] pr-4">
          <div class="space-y-3">
            {#each filteredTemplates as template}
              <button
                type="button"
                onclick={() => handleSelectTemplate(template)}
                class="hover:border-primary hover:bg-accent w-full rounded-lg border p-4 text-left transition-colors"
              >
                <div class="mb-2 flex items-start justify-between gap-2">
                  <h3 class="font-semibold">{template.title}</h3>
                  <Badge variant="secondary" class="text-xs">{template.category}</Badge>
                </div>
                <p class="text-muted-foreground text-sm">{template.description}</p>
              </button>
            {/each}
          </div>
        </ScrollArea>
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
