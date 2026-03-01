<script lang="ts">
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { AlertCircle } from '@lucide/svelte';

	export interface ContactMethodsFormData {
		email: string;
		phone: string;
		telegram_username: string;
		whatsapp: string;
		signal: string;
		preferred_method: 'email' | 'phone' | 'both';
		check_in_days: number;
	}

	interface Props {
		onSubmit: (methods: ContactMethodsFormData) => Promise<void>;
		initialValues?: ContactMethodsFormData | null;
		submitLabel?: string;
		showCancel?: boolean;
		onCancel?: () => void;
	}

	let {
		onSubmit,
		initialValues = null,
		submitLabel = 'Save Changes',
		showCancel = false,
		onCancel
	}: Props = $props();

	const defaults: ContactMethodsFormData = {
		email: '',
		phone: '',
		telegram_username: '',
		whatsapp: '',
		signal: '',
		preferred_method: 'email',
		check_in_days: 90
	};

	let formData = $state<ContactMethodsFormData>({ ...(initialValues ?? defaults) });
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	let emailError = $derived(
		formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
			? 'Please enter a valid email address'
			: null
	);

	let hasAtLeastOneMethod = $derived(!!formData.email || !!formData.phone);

	const preferredMethodLabels: Record<string, string> = {
		email: 'Email',
		phone: 'Phone',
		both: 'Both Email and Phone'
	};

	let preferredMethodLabel = $derived(
		preferredMethodLabels[formData.preferred_method] ?? formData.preferred_method
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();

		if (emailError) return;
		if (!hasAtLeastOneMethod) {
			error = 'Please provide at least one contact method (email or phone).';
			return;
		}

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
			<Label for="contact-email">Email</Label>
			<Input
				id="contact-email"
				type="email"
				placeholder="Your email address"
				bind:value={formData.email}
				onkeydown={handleKeyDown}
				aria-invalid={!!emailError}
			/>
			{#if emailError}
				<p class="text-sm text-destructive">{emailError}</p>
			{/if}
		</div>

		<div class="space-y-2">
			<Label for="contact-phone">Phone</Label>
			<Input
				id="contact-phone"
				type="tel"
				placeholder="Your phone number"
				bind:value={formData.phone}
				onkeydown={handleKeyDown}
			/>
		</div>

		<div class="space-y-2">
			<Label for="contact-telegram">Telegram Username</Label>
			<Input
				id="contact-telegram"
				type="text"
				placeholder="Your telegram username"
				bind:value={formData.telegram_username}
				onkeydown={handleKeyDown}
			/>
		</div>

		<div class="space-y-2">
			<Label for="contact-whatsapp">WhatsApp</Label>
			<Input
				id="contact-whatsapp"
				type="tel"
				placeholder="Your WhatsApp number"
				bind:value={formData.whatsapp}
				onkeydown={handleKeyDown}
			/>
		</div>

		<div class="space-y-2">
			<Label for="contact-signal">Signal</Label>
			<Input
				id="contact-signal"
				type="tel"
				placeholder="Your Signal number"
				bind:value={formData.signal}
				onkeydown={handleKeyDown}
			/>
		</div>

		<div class="space-y-2">
			<Label>Preferred Contact Method</Label>
			<Select.Root type="single" bind:value={formData.preferred_method}>
				<Select.Trigger class="w-full">
					<span>{preferredMethodLabel}</span>
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="email">Email</Select.Item>
					<Select.Item value="phone">Phone</Select.Item>
					<Select.Item value="both">Both Email and Phone</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-2">
			<Label for="contact-checkin-days">Check-in Days</Label>
			<Input
				id="contact-checkin-days"
				type="number"
				min={1}
				max={365}
				bind:value={formData.check_in_days}
				onkeydown={handleKeyDown}
			/>
		</div>

		<div class="flex justify-end space-x-4">
			{#if showCancel}
				<Button type="button" variant="outline" onclick={onCancel} class="uppercase tracking-wide">Cancel</Button>
			{/if}
			<Button type="submit" disabled={isLoading || !!emailError} class="uppercase tracking-wide">
				{isLoading ? 'Saving...' : submitLabel}
			</Button>
		</div>
	</form>
</div>
