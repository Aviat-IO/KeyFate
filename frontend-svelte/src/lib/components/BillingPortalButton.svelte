<script lang="ts">
  import { Button } from '$lib/components/ui/button';

  let loading = $state(false);

  async function handlePortal() {
    loading = true;

    try {
      const csrfRes = await fetch('/api/csrf-token');
      const { token } = await csrfRes.json();

      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token
        }
      });

      if (response.redirected) {
        window.location.href = response.url;
      } else {
        console.error('Portal creation failed');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      loading = false;
    }
  }
</script>

<Button onclick={handlePortal} disabled={loading} variant="outline" class="">
  {loading ? 'Loading...' : 'Manage Billing'}
</Button>
