<script lang="ts">
	import ContactMethodsForm from '$lib/components/ContactMethodsForm.svelte';
	import type { ContactMethodsFormData } from '$lib/components/ContactMethodsForm.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let initialValues = $derived.by<ContactMethodsFormData | null>(() => {
		const cm = data.contactMethod;
		if (!cm) return null;
		return {
			email: cm.email,
			phone: cm.phone,
			telegram_username: '',
			whatsapp: '',
			signal: '',
			preferred_method: cm.preferredMethod ?? 'email',
			check_in_days: 90
		};
	});

	async function handleSave(methods: ContactMethodsFormData) {
		const response = await fetch('/api/user/contact-methods', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: methods.email || undefined,
				phone: methods.phone || undefined,
				preferredMethod: methods.preferred_method
			})
		});

		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new Error(body?.error ?? 'Failed to update contact methods');
		}

		toast.success('Contact methods updated successfully');
	}
</script>

<svelte:head>
	<title>Profile Settings - KeyFate</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-6 py-12">
	<h1 class="font-space mb-8 text-3xl font-light tracking-tight">Profile Settings</h1>

	<div class="space-y-12">
		<div>
			<h2 class="font-space mb-4 text-xl font-bold tracking-tight">Contact Methods</h2>
			<p class="text-muted-foreground mb-6">
				Configure how we can reach you for notifications and alerts.
			</p>
			<ContactMethodsForm onSubmit={handleSave} {initialValues} />
		</div>
	</div>
</div>
