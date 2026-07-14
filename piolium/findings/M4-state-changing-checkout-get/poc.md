# PoC — provider side effects from top-level GET

PoC-Status: theoretical

A page on another origin can navigate an authenticated user to a GET endpoint:

```html
<a href="https://TARGET.invalid/api/create-checkout-session?lookup_key=monthly">
  Continue
</a>
```

Because the auth cookie is `SameSite=Lax`, a top-level navigation may include it. The handler then creates a Stripe customer and Checkout Session before redirecting. The BTCPay GET path analogously creates an invoice. SvelteKit's form-origin check does not convert GET into a safe method.

No provider objects were created during this audit because no disposable Stripe/BTCPay account was available.
