# BTCPay Server for Cloud Run

This directory contains the BTCPay Server configuration optimized for Google Cloud Run deployment using Cloud Foundation Fabric.

## Overview

This setup is inspired by the [official BTCPay Server Google Cloud deployment](https://github.com/btcpayserver/btcpayserver-googlecloud) but adapted for modern Cloud Run deployment instead of VM-based deployment.

## Features

- **Cloud Run Optimized**: Configured for serverless deployment
- **SQLite Database**: Lightweight database suitable for Cloud Run
- **Environment-based Configuration**: Easy configuration through environment variables
- **Health Checks**: Built-in health monitoring for Cloud Run
- **Development Support**: Local Docker Compose for testing

## Configuration

The BTCPay server is configured through environment variables set in the Terraform configuration:

### Core Variables

- `BTCPAY_EXTERNALURL`: Your BTCPay server's public URL
- `BTCPAY_NETWORK`: Bitcoin network (mainnet, testnet, regtest)
- `BTCPAY_EXPLORERURL`: Bitcoin block explorer URL

### Advanced Configuration

Additional configuration can be added through the `btcpay.conf` file or environment variables as needed.

## Local Development

To test BTCPay server locally:

```bash
cd btcpayserver
docker-compose up -d
```

This will start BTCPay server on `http://localhost:8080` in testnet mode.

## Production Deployment

The production deployment is handled automatically by Terraform when you run:

```bash
cd infrastructure/terragrunt/dev  # or prod
terragrunt apply
```

The Terraform configuration will:
1. Build the Docker image
2. Push it to Google Artifact Registry
3. Deploy it to Cloud Run
4. Configure all environment variables
5. Set up domain mapping (if configured)

## File Structure

```
btcpayserver/
├── Dockerfile              # Cloud Run optimized container
├── docker-compose.yml      # Local development setup
├── btcpay.conf             # BTCPay server configuration
└── README.md               # This file
```

## Environment Variables

The following environment variables are automatically configured by Terraform:

| Variable | Description | Example |
|----------|-------------|---------|
| `BTCPAY_EXTERNALURL` | Public URL of your BTCPay server | `https://btcpay.yourdomain.com` |
| `BTCPAY_NETWORK` | Bitcoin network to use | `mainnet`, `testnet`, `regtest` |
| `BTCPAY_EXPLORERURL` | Bitcoin explorer URL | `https://blockstream.info` |

## Security Considerations

- **Database**: Uses SQLite by default for simplicity. For production with high load, consider PostgreSQL
- **SSL/TLS**: Handled automatically by Cloud Run and Google Load Balancer
- **Registration**: Can be disabled after initial admin setup
- **API Keys**: Stored securely in the BTCPay database

## Scaling

Cloud Run automatically scales based on demand:
- **Minimum Instances**: 0 (configured in Terraform)
- **Maximum Instances**: 5 (configured in Terraform)
- **CPU**: 2000m (2 vCPU cores)
- **Memory**: 2Gi RAM

## Monitoring

- **Health Checks**: Built-in health endpoint at `/health`
- **Logs**: Available in Google Cloud Console
- **Metrics**: Automatic Cloud Run metrics in Cloud Monitoring

## Troubleshooting

### Common Issues

1. **Container fails to start**: Check environment variables in Cloud Run console
2. **Database issues**: Verify SQLite file permissions and storage
3. **Network connectivity**: Ensure proper Cloud Run configuration

### Logs

Access logs through:
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit=50
```

Or through the Google Cloud Console.

## References

- [BTCPay Server Documentation](https://docs.btcpayserver.org/)
- [BTCPay Server Google Cloud Repository](https://github.com/btcpayserver/btcpayserver-googlecloud)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Docker Hub BTCPay Server](https://hub.docker.com/r/btcpayserver/btcpayserver)
