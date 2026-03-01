<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Download, Clock, CircleCheck, CircleX, LoaderCircle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface SerializedExportJob {
		id: string;
		userId: string;
		status: string;
		fileUrl: string | null;
		fileSize: number | null;
		downloadCount: number;
		expiresAt: string;
		createdAt: string;
		completedAt: string | null;
		errorMessage: string | null;
	}

	let { recentExports }: { recentExports: SerializedExportJob[] } = $props();

	let isRequesting = $state(false);

	async function handleRequestExport() {
		isRequesting = true;
		try {
			const response = await fetch('/api/user/export-data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const data = await response.json();

			if (!response.ok) {
				if (data.code === 'RATE_LIMITED') {
					toast.error('Rate Limited', { description: data.error });
				} else {
					throw new Error(data.error || 'Failed to request export');
				}
				return;
			}

			toast.success('Export Requested', {
				description: "Your data export has been queued. You'll receive an email when it's ready."
			});

			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (err) {
			toast.error('Error', {
				description: err instanceof Error ? err.message : 'Failed to request data export'
			});
		} finally {
			isRequesting = false;
		}
	}

	function formatDate(date: string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatFileSize(bytes: number | null): string {
		if (!bytes) return 'N/A';
		const mb = bytes / 1024 / 1024;
		return `${mb.toFixed(2)} MB`;
	}

	function isExpired(expiresAt: string): boolean {
		return new Date(expiresAt) < new Date();
	}
</script>

<div class="space-y-6">
	<div>
		<h3 class="font-space text-lg font-bold tracking-tight">Export Your Data</h3>
		<p class="text-sm text-muted-foreground mt-1">
			Download a complete copy of your personal data in JSON format. This includes your secrets,
			check-in history, audit logs, and subscription information.
		</p>
	</div>

	<div class="space-y-6">
		<div class="flex items-start gap-4">
			<div class="flex-1">
				<p class="text-sm text-muted-foreground">
					Exports are available for 24 hours and can be downloaded up to 3 times. You can
					request one export every 24 hours.
				</p>
			</div>
			<Button onclick={handleRequestExport} disabled={isRequesting} class="shrink-0 uppercase tracking-wide font-semibold">
				{#if isRequesting}
					<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
					Requesting...
				{:else}
					<Download class="mr-2 h-4 w-4" />
					Request Export
				{/if}
			</Button>
		</div>

		{#if recentExports.length > 0}
			<div>
				<h4 class="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">Recent Exports</h4>
				<div class="space-y-3">
					{#each recentExports as exportJob}
						<div class="flex items-center justify-between border-b border-border pb-3 last:border-0">
							<div class="flex flex-col gap-1">
								<div class="flex items-center gap-2">
									{#if exportJob.status === 'pending'}
										<Badge variant="secondary" class="gap-1">
											<Clock class="h-3 w-3" />
											Pending
										</Badge>
									{:else if exportJob.status === 'processing'}
										<Badge variant="secondary" class="gap-1">
											<LoaderCircle class="h-3 w-3 animate-spin" />
											Processing
										</Badge>
									{:else if exportJob.status === 'completed'}
										<Badge variant="default" class="gap-1">
											<CircleCheck class="h-3 w-3" />
											Ready
										</Badge>
									{:else if exportJob.status === 'failed'}
										<Badge variant="destructive" class="gap-1">
											<CircleX class="h-3 w-3" />
											Failed
										</Badge>
									{:else}
										<Badge variant="outline">{exportJob.status}</Badge>
									{/if}
									<span class="text-muted-foreground text-xs">
										Requested {formatDate(exportJob.createdAt)}
									</span>
								</div>
								{#if exportJob.fileSize}
									<span class="text-muted-foreground text-xs">
										Size: {formatFileSize(exportJob.fileSize)} • Downloads: {exportJob.downloadCount}/3
									</span>
								{/if}
								{#if exportJob.expiresAt}
									<span
										class="text-xs {isExpired(exportJob.expiresAt)
											? 'text-destructive'
											: 'text-muted-foreground'}"
									>
										{isExpired(exportJob.expiresAt)
											? 'Expired'
											: `Expires ${formatDate(exportJob.expiresAt)}`}
									</span>
								{/if}
							</div>
							{#if exportJob.status === 'completed' && exportJob.fileUrl && !isExpired(exportJob.expiresAt) && exportJob.downloadCount < 3}
								<Button
									size="sm"
									variant="outline"
									onclick={() => {
										if (exportJob.fileUrl) {
											window.open(exportJob.fileUrl, '_blank');
										}
									}}
									class="uppercase tracking-wide font-semibold"
								>
									<Download class="mr-2 h-3 w-3" />
									Download
								</Button>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
