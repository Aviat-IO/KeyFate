# BTCPay Server Setup Guide

This guide explains how to set up your own BTCPay Server instance for Bitcoin payment processing with KeyFate.

## Overview

KeyFate integrates with external BTCPay Server instances for Bitcoin and Lightning Network payments. Instead of hosting BTCPay Server ourselves, we recommend setting up your own self-hosted instance for maximum control and privacy.

## Setup Tutorial

Follow this comprehensive video tutorial to set up your BTCPay Server:

**[How to Setup BTCPay Server - Complete Tutorial](https://www.youtube.com/watch?v=-GJr4XjRCPo)**

This tutorial covers:

- Complete BTCPay Server installation
- Configuration for Bitcoin and Lightning Network
- Security best practices
- Store setup and API key generation

## Configuration

After setting up your BTCPay Server using the tutorial above, you'll need to configure KeyFate to connect to your instance.

### Required Configuration

Add these values to your `terraform.tfvars` file:

```hcl
# BTCPay Server configuration (external hosting)
btcpay_server_url     = "https://your-btcpay-server.com"
btcpay_api_key        = "your-api-key-from-btcpay"
btcpay_store_id       = "your-store-id-from-btcpay"
btcpay_webhook_secret = "your-webhook-secret"
```

### Getting Your BTCPay Server Credentials

#### 1. API Key

1. Log into your BTCPay Server
2. Go to Account → Manage Account → API Keys
3. Create a new API key with these permissions:
   - `btcpay.store.canmodifyinvoices`
   - `btcpay.store.canviewinvoices`
   - `btcpay.store.canviewstoresettings`

#### 2. Store ID

1. In BTCPay Server, go to your store
2. The Store ID is visible in the store settings URL: `/stores/{STORE_ID}/settings`

#### 3. Webhook Secret

1. Go to Store Settings → Webhooks
2. Create a new webhook pointing to: `https://your-keyfate-domain.com/api/webhooks/btcpay`
3. Set a secure secret and use the same value in your configuration

#### 4. Configure Exchange Rate Providers

**CRITICAL**: BTCPay Server requires rate providers to be configured for currency conversion to work properly.

1. In your BTCPay Server, go to Store Settings → Rates
2. Add at least one rate provider from the available options:
   - **CoinGecko** (Recommended - free tier available)
   - **Kraken**
   - **Bitfinex**
   - **CoinDesk**
3. Set your preferred rate source
4. Test the configuration by checking if rates appear in the Rates tab

**Testing Rate Configuration:**

```bash
# Test if rates are working
curl -X GET \
  https://your-btcpay-server.com/api/v1/stores/YOUR_STORE_ID/rates \
  -H "Authorization: token YOUR_API_KEY"
```

This should return an array of currency rates, not an empty array. If empty, double-check your rate provider configuration.

## Environment Variables

The system uses these environment variables that will be automatically configured when you deploy your KeyFate application:

- `NEXT_PUBLIC_BTCPAY_SERVER_URL` - Public URL (for client-side)
- `BTCPAY_SERVER_URL` - Server URL (for server-side API calls)
- `BTCPAY_API_KEY` - API key for authentication
- `BTCPAY_STORE_ID` - Store identifier
- `BTCPAY_WEBHOOK_SECRET` - Webhook verification secret

## Deployment Steps

1. **Set up your BTCPay Server** using the tutorial video linked above

2. **Configure your credentials** in `terraform.tfvars` as shown in the Configuration section

3. **Deploy your KeyFate application**:

   ```bash
   cd infrastructure/terragrunt/dev
   terragrunt init
   terragrunt plan
   terragrunt apply
   ```

## Security Notes

- Keep your API key secure and never commit it to version control
- Use strong webhook secrets
- Ensure your BTCPay Server uses HTTPS
- Regularly rotate API keys

## Testing Your Integration

### 1. Test API Connectivity

```bash
# Test BTCPay API connectivity
curl -X GET \
  https://your-btcpay-server.com/api/v1/stores/YOUR_STORE_ID \
  -H "Authorization: token YOUR_API_KEY"
```

### 2. Test Invoice Creation

```bash
curl -X POST \
  https://your-btcpay-server.com/api/v1/stores/YOUR_STORE_ID/invoices \
  -H "Authorization: token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "0.001",
    "currency": "BTC",
    "metadata": {
      "test": "true"
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Empty Rates Array**: This is the most common issue and indicates rate providers are not configured
   - Go to Store Settings → Rates in BTCPay Server
   - Add at least one rate provider (CoinGecko recommended)
   - Test with the curl command above
   - KeyFate will fall back to CoinGecko API if BTCPay rates are unavailable

2. **API Connection Issues**: Verify your BTCPay Server is accessible and API key is correct

3. **Webhook Not Working**: Check webhook URL and secret configuration

4. **Invoice Creation Failures**: Ensure store ID is correct and API key has proper permissions

5. **Network Issues**: Verify firewall settings allow HTTPS traffic

### Debugging Steps

1. **Check BTCPay Server Status**: Ensure your BTCPay Server instance is running

2. **Verify API Key Permissions**: Your API key needs these permissions:

   ```text
   btcpay.store.canmodifyinvoices
   btcpay.store.cancreateinvoice
   btcpay.store.canviewinvoices
   btcpay.store.canviewstoresettings
   ```

3. **Test Rate Endpoints Manually**: Try these commands to debug rate issues:

   ```bash
   # Primary endpoint
   curl -X GET \
     https://your-btcpay-server.com/api/v1/stores/YOUR_STORE_ID/rates \
     -H "Authorization: token YOUR_API_KEY"

   # Alternative endpoints for different BTCPay versions
   curl -X GET \
     https://your-btcpay-server.com/api/v1/rates \
     -H "Authorization: token YOUR_API_KEY"

   # Check store settings (should show rate configuration)
   curl -X GET \
     https://your-btcpay-server.com/api/v1/stores/YOUR_STORE_ID \
     -H "Authorization: token YOUR_API_KEY"
   ```

4. **Force Rate Provider Refresh**: In BTCPay Server UI:
   - Go to Store Settings → Rates
   - Save the configuration (even without changes)
   - Wait 1-2 minutes for providers to initialize
   - Test the API endpoints again

5. **Check Webhook Logs**: Look at BTCPay Server webhook delivery logs

6. **Review KeyFate Logs**: Check your application logs for BTCPay integration errors

## Maintenance

### Regular Tasks

1. **Update BTCPay Server**: Keep your BTCPay Server instance updated
2. **Monitor Bitcoin Node**: Ensure your Bitcoin node is synced
3. **Backup Wallet**: Regularly backup your BTCPay Server wallet
4. **Rotate API Keys**: Periodically rotate API keys for security

## References

- [BTCPay Server Documentation](https://docs.btcpayserver.org/)
- [BTCPay Server Setup Tutorial](https://www.youtube.com/watch?v=-GJr4XjRCPo)
- [BTCPay Server API Documentation](https://docs.btcpayserver.org/API/Greenfield/v1/)
- [KeyFate Integration Guide](../btcpay-integration.md)
