<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Check, X } from '@lucide/svelte';

  let {
    open = $bindable(false),
    onOpenChange,
    feature = 'this feature',
    currentLimit,
    proLimit
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feature?: string;
    currentLimit?: string;
    proLimit?: string;
  } = $props();
</script>

<Dialog.Root bind:open onOpenChange={onOpenChange}>
  <Dialog.Content class="sm:max-w-[600px]">
    <Dialog.Header>
      <Dialog.Title class="text-2xl">Upgrade to Pro</Dialog.Title>
      <Dialog.Description>Unlock {feature} and get access to premium features</Dialog.Description>
    </Dialog.Header>

    <div class="grid gap-6 py-4">
      {#if currentLimit && proLimit}
        <div class="bg-muted/50 rounded-lg border p-4">
          <div class="text-muted-foreground mb-2 text-sm">Your Limit</div>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold">Free Tier</div>
              <div class="text-muted-foreground text-sm">{currentLimit}</div>
            </div>
            <div class="text-right">
              <div class="text-primary font-semibold">Pro Tier</div>
              <div class="text-primary text-sm">{proLimit}</div>
            </div>
          </div>
        </div>
      {/if}

      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border p-4">
          <div class="mb-3 flex items-center gap-2">
            <Badge variant="outline">Free</Badge>
          </div>
          <div class="space-y-2">
            <div class="flex items-start gap-2">
              <Check class="text-muted-foreground mt-0.5 h-4 w-4" />
              <span class="text-sm">1 secret</span>
            </div>
            <div class="flex items-start gap-2">
              <Check class="text-muted-foreground mt-0.5 h-4 w-4" />
              <span class="text-sm">1 recipient per secret</span>
            </div>
            <div class="flex items-start gap-2">
              <Check class="text-muted-foreground mt-0.5 h-4 w-4" />
              <span class="text-sm">3 check-in intervals</span>
            </div>
            <div class="flex items-start gap-2">
              <X class="text-muted-foreground mt-0.5 h-4 w-4" />
              <span class="text-muted-foreground text-sm">No message templates</span>
            </div>
          </div>
        </div>

        <div class="border-primary relative rounded-lg border-2 p-4">
          <Badge class="bg-primary absolute -top-3 left-4">Recommended</Badge>
          <div class="mb-3 flex items-center gap-2">
            <Badge>Pro</Badge>
            <span class="text-xl font-bold">$9/mo</span>
          </div>
          <div class="space-y-2">
            <div class="flex items-start gap-2">
              <Check class="text-primary mt-0.5 h-4 w-4" />
              <span class="text-sm font-medium">10 secrets</span>
            </div>
            <div class="flex items-start gap-2">
              <Check class="text-primary mt-0.5 h-4 w-4" />
              <span class="text-sm font-medium">5 recipients per secret</span>
            </div>
            <div class="flex items-start gap-2">
              <Check class="text-primary mt-0.5 h-4 w-4" />
              <span class="text-sm font-medium">Custom intervals (1 day to 3 years)</span>
            </div>
            <div class="flex items-start gap-2">
              <Check class="text-primary mt-0.5 h-4 w-4" />
              <span class="text-sm font-medium">Message templates</span>
            </div>
          </div>
          <div class="text-muted-foreground mt-4 text-xs">or $90/year (save 17%)</div>
        </div>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => onOpenChange(false)}>Maybe Later</Button>
      <Button href="/pricing">Upgrade to Pro</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
