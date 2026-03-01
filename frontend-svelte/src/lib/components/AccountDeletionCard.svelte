<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { AlertTriangle, Trash2, LoaderCircle, Clock, CircleX } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface SerializedDeletionRequest {
		id: string;
		userId: string;
		status: string;
		confirmationToken: string;
		confirmationSentAt: string;
		confirmedAt: string | null;
		scheduledDeletionAt: string | null;
		cancelledAt: string | null;
		deletedAt: string | null;
		createdAt: string;
	}

	let { activeDeletionRequest }: { activeDeletionRequest: SerializedDeletionRequest | null } =
		$props();

	let isDeleting = $state(false);
	let isCancelling = $state(false);
	let alertOpen = $state(false);

	async function handleRequestDeletion() {
		isDeleting = true;
		try {
			const response = await fetch('/api/user/delete-account', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'x-reauth-token': 'mock-token'
				}
			});

			const data = await response.json();

			if (!response.ok) {
				if (data.code === 'ALREADY_PENDING') {
					toast.error('Deletion Already Pending', { description: data.error });
				} else {
					throw new Error(data.error || 'Failed to request deletion');
				}
				return;
			}

			toast.success('Deletion Requested', {
				description:
					"Check your email to confirm the deletion request. You'll have 30 days to cancel."
			});

			alertOpen = false;

			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (err) {
			toast.error('Error', {
				description:
					err instanceof Error ? err.message : 'Failed to request account deletion'
			});
		} finally {
			isDeleting = false;
		}
	}

	async function handleCancelDeletion() {
		if (!activeDeletionRequest) return;

		isCancelling = true;
		try {
			const response = await fetch(
				`/api/user/delete-account/cancel/${activeDeletionRequest.id}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				}
			);

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to cancel deletion');
			}

			toast.success('Deletion Cancelled', {
				description: 'Your account deletion request has been cancelled.'
			});

			setTimeout(() => {
				window.location.reload();
			}, 2000);
		} catch (err) {
			toast.error('Error', {
				description:
					err instanceof Error ? err.message : 'Failed to cancel deletion request'
			});
		} finally {
			isCancelling = false;
		}
	}

	function formatDate(date: string | null): string {
		if (!date) return 'N/A';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getDaysRemaining(scheduledDate: string | null): number {
		if (!scheduledDate) return 0;
		const now = new Date();
		const scheduled = new Date(scheduledDate);
		const diffTime = scheduled.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.max(0, diffDays);
	}
</script>

<div class="border-t border-border pt-8 space-y-6">
	<div>
		<h3 class="font-space text-lg font-bold tracking-tight text-destructive flex items-center gap-2">
			<AlertTriangle class="h-5 w-5" />
			Delete Account
		</h3>
		<p class="text-sm text-muted-foreground mt-1">
			Permanently delete your account and all associated data. This action cannot be undone.
		</p>
	</div>

	<div class="space-y-6">
		{#if activeDeletionRequest}
			<div class="border-destructive/50 rounded-lg border p-4">
				<div class="mb-3 flex items-center gap-2">
					{#if activeDeletionRequest.status === 'pending'}
						<Badge variant="secondary" class="gap-1">
							<Clock class="h-3 w-3" />
							Pending Confirmation
						</Badge>
					{:else}
						<Badge variant="destructive" class="gap-1">
							<AlertTriangle class="h-3 w-3" />
							Scheduled for Deletion
						</Badge>
					{/if}
				</div>

				{#if activeDeletionRequest.status === 'pending'}
					<div class="space-y-2">
						<p class="text-sm font-medium">Deletion request pending email confirmation</p>
						<p class="text-muted-foreground text-sm">
							Check your email and click the confirmation link to proceed with deletion.
						</p>
					</div>
				{/if}

				{#if activeDeletionRequest.status === 'confirmed' && activeDeletionRequest.scheduledDeletionAt}
					<div class="space-y-2">
						<p class="text-sm font-medium">
							Account scheduled for deletion on {formatDate(
								activeDeletionRequest.scheduledDeletionAt
							)}
						</p>
						<p class="text-muted-foreground text-sm">
							{getDaysRemaining(activeDeletionRequest.scheduledDeletionAt)} days remaining in
							grace period. You can cancel this request at any time before the scheduled date.
						</p>
					</div>
				{/if}

				<Button
					variant="outline"
					size="sm"
					onclick={handleCancelDeletion}
					disabled={isCancelling}
					class="mt-4 font-semibold"
				>
					{#if isCancelling}
						<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
						Cancelling...
					{:else}
						<CircleX class="mr-2 h-4 w-4" />
						Cancel Deletion Request
					{/if}
				</Button>
			</div>
		{:else}
			<div class="space-y-6">
				<div class="space-y-2">
					<span class="text-xs text-muted-foregroundr font-medium">What happens when you delete your account</span>
					<ul class="text-muted-foreground ml-4 list-disc space-y-1 text-sm mt-2">
						<li>All your secrets and check-in data will be permanently deleted</li>
						<li>Your audit logs and activity history will be removed</li>
						<li>Any pending data exports will be cancelled</li>
						<li>Your subscription will be immediately cancelled</li>
						<li>You'll have a 30-day grace period to change your mind</li>
					</ul>
				</div>

				<AlertDialog.Root bind:open={alertOpen}>
					<AlertDialog.Trigger
						class="bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-semibold sm:w-auto"
					>
						<Trash2 class="mr-2 h-4 w-4" />
						Delete My Account
					</AlertDialog.Trigger>
					<AlertDialog.Content>
						<AlertDialog.Header>
							<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
							<AlertDialog.Description>
								<div class="space-y-2">
									<p>
										This will initiate the account deletion process. You'll receive an email
										to confirm your decision.
									</p>
									<p class="text-destructive font-medium">
										After confirmation, you'll have 30 days to cancel before all your data
										is permanently deleted.
									</p>
								</div>
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<AlertDialog.Action
								onclick={handleRequestDeletion}
								disabled={isDeleting}
								class="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
							>
								{#if isDeleting}
									<LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
									Processing...
								{:else}
									Yes, Delete My Account
								{/if}
							</AlertDialog.Action>
						</AlertDialog.Footer>
					</AlertDialog.Content>
				</AlertDialog.Root>
			</div>
		{/if}
	</div>
</div>
