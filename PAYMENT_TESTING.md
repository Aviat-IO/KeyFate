# Payment Testing

## BTCPay Server

### Test Environment (Dev/Staging)

- **Pricing**: 10 sats (monthly) / 100 sats (annual) ≈ $0.005-$0.05
- **Setup**: Set `NEXT_PUBLIC_ENV=development` in `.env.local`
- **Endpoint**: Point to BTCPay test instance

### Production

- **Pricing**: 20,000 sats (monthly) / 200,000 sats (annual) ≈ $9-$90
- **Setup**: Set `NEXT_PUBLIC_ENV=production` or omit variable

### Testing Flow

1. Navigate to upgrade page
2. Select BTCPay payment option
3. Complete payment in BTCPay UI
4. Verify webhook callback updates subscription

## Stripe

### Test Mode

- **Test Cards**:
  - Success: `4242 4242 4242 4242`
  - Decline: `4000 0000 0000 0002`
  - 3D Secure: `4000 0027 6000 3184`
- **Setup**: Use Stripe test API keys in `.env.local`
- **Webhooks**: Use Stripe CLI for local testing:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```

### Production

- **Setup**: Use Stripe production API keys
- **Webhook**: Configure production webhook URL in Stripe dashboard

### Testing Flow

1. Navigate to upgrade page
2. Select Stripe payment option
3. Use test card number
4. Verify webhook updates subscription

## Environment Variables

```bash
# Development
NEXT_PUBLIC_ENV=development

# BTCPay
BTCPAY_SERVER_URL=your-btcpay-url
BTCPAY_STORE_ID=your-store-id
BTCPAY_API_KEY=your-api-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

See `frontend/.env.local.example` for complete configuration.
