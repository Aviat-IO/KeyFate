<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Download } from '@lucide/svelte';

  interface AuditLog {
    id: string;
    eventType: string;
    eventCategory: string;
    resourceType: string | null;
    resourceId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    details: Record<string, unknown> | null;
  }

  let logs = $state<AuditLog[]>([]);
  let loading = $state(false);
  let currentPage = $state(1);
  let totalPages = $state(1);
  let eventTypeFilter = $state('');
  let categoryFilter = $state('');
  let startDateStr = $state('');
  let endDateStr = $state('');
  let search = $state('');

  async function fetchLogs() {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50'
      });

      if (eventTypeFilter) params.append('event_type', eventTypeFilter);
      if (categoryFilter) params.append('event_category', categoryFilter);
      if (startDateStr) params.append('start_date', new Date(startDateStr).toISOString());
      if (endDateStr) params.append('end_date', new Date(endDateStr).toISOString());
      if (search) params.append('search', search);

      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const data = await response.json();
      logs = data.logs;
      totalPages = data.pagination.totalPages;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    // Track all filter dependencies
    void currentPage;
    void eventTypeFilter;
    void categoryFilter;
    void startDateStr;
    void endDateStr;
    void search;
    fetchLogs();
  });

  async function handleExport(format: 'csv' | 'json') {
    try {
      const params = new URLSearchParams({ format });
      if (eventTypeFilter) params.append('event_type', eventTypeFilter);
      if (categoryFilter) params.append('event_category', categoryFilter);
      if (startDateStr) params.append('start_date', new Date(startDateStr).toISOString());
      if (endDateStr) params.append('end_date', new Date(endDateStr).toISOString());

      const response = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to export audit logs');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  }

  function formatEventType(eventType: string): string {
    return eventType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
</script>

<div class="space-y-6">
  <!-- Filters -->
  <div class="flex flex-wrap gap-4">
    <Select.Root type="single" bind:value={eventTypeFilter}>
      <Select.Trigger class="w-[200px]">
        <span>{eventTypeFilter ? formatEventType(eventTypeFilter) : 'All Events'}</span>
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Events</Select.Item>
        <Select.Item value="secret_created">Secret Created</Select.Item>
        <Select.Item value="secret_edited">Secret Edited</Select.Item>
        <Select.Item value="secret_deleted">Secret Deleted</Select.Item>
        <Select.Item value="check_in">Check In</Select.Item>
        <Select.Item value="secret_triggered">Secret Triggered</Select.Item>
        <Select.Item value="recipient_added">Recipient Added</Select.Item>
        <Select.Item value="recipient_removed">Recipient Removed</Select.Item>
        <Select.Item value="settings_changed">Settings Changed</Select.Item>
        <Select.Item value="login">Login</Select.Item>
        <Select.Item value="subscription_changed">Subscription Changed</Select.Item>
      </Select.Content>
    </Select.Root>

    <Select.Root type="single" bind:value={categoryFilter}>
      <Select.Trigger class="w-[200px]">
        <span>{categoryFilter ? categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1) : 'All Categories'}</span>
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Categories</Select.Item>
        <Select.Item value="secrets">Secrets</Select.Item>
        <Select.Item value="authentication">Authentication</Select.Item>
        <Select.Item value="subscriptions">Subscriptions</Select.Item>
        <Select.Item value="settings">Settings</Select.Item>
        <Select.Item value="recipients">Recipients</Select.Item>
      </Select.Content>
    </Select.Root>

    <Input
      type="date"
      placeholder="Start Date"
      bind:value={startDateStr}
      class="w-[200px]"
    />

    <Input type="date" placeholder="End Date" bind:value={endDateStr} class="w-[200px]" />

    <div class="ml-auto flex gap-2">
      <Button variant="outline" size="sm" onclick={() => handleExport('csv')} class="font-semibold">
        <Download class="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onclick={() => handleExport('json')} class="font-semibold">
        <Download class="mr-2 h-4 w-4" />
        Export JSON
      </Button>
    </div>
  </div>

  <!-- Table -->
  <div class="rounded-md border">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head class="text-xs text-muted-foregroundr">Event</Table.Head>
          <Table.Head class="text-xs text-muted-foregroundr">Category</Table.Head>
          <Table.Head class="text-xs text-muted-foregroundr">Resource</Table.Head>
          <Table.Head class="text-xs text-muted-foregroundr">Date</Table.Head>
          <Table.Head class="text-xs text-muted-foregroundr">IP Address</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if loading}
          <Table.Row>
            <Table.Cell colspan={5} class="text-center text-sm text-muted-foreground">Loading...</Table.Cell>
          </Table.Row>
        {:else if logs.length === 0}
          <Table.Row>
            <Table.Cell colspan={5} class="text-center text-sm text-muted-foreground">No audit logs found</Table.Cell>
          </Table.Row>
        {:else}
          {#each logs as log}
            <Table.Row>
              <Table.Cell class="text-sm">{formatEventType(log.eventType)}</Table.Cell>
              <Table.Cell class="text-sm capitalize">{log.eventCategory}</Table.Cell>
              <Table.Cell class="text-sm">
                {#if log.resourceType && log.resourceId}
                  <Tooltip.Provider>
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        <span class="inline-block max-w-[200px] cursor-help truncate">
                          {log.resourceType}: {log.resourceId.slice(0, 8)}...
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        <p class="max-w-sm break-all">
                          {log.resourceType}: {log.resourceId}
                        </p>
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                {:else}
                  -
                {/if}
              </Table.Cell>
              <Table.Cell class="text-sm">{new Date(log.createdAt).toLocaleString()}</Table.Cell>
              <Table.Cell class="text-sm">{log.ipAddress || '-'}</Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Pagination -->
  <div class="flex items-center justify-between">
    <div class="text-xs text-muted-foregroundr">
      Page {currentPage} of {totalPages}
    </div>
    <div class="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={() => (currentPage = Math.max(1, currentPage - 1))}
        disabled={currentPage === 1 || loading}
        class="font-semibold"
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages || loading}
        class="font-semibold"
      >
        Next
      </Button>
    </div>
  </div>
</div>
