# BTCPay Server Cloud Run Prototype (Historical)

> **Legacy GCP reference only.** KeyFate's supported application platform is Railway. Do not deploy this directory as part of the current production release.

This directory preserves an earlier Cloud Run/Cloud Foundation Fabric BTCPay prototype. It is not an approved deployment unit, current runbook, or evidence of a configured provider.

The application can integrate with an independently operated BTCPay provider through the documented environment contract, but production use remains blocked until a named owner proves the endpoint, credentials, webhook authenticity, payment lifecycle, monitoring, backup/restore, and rollback in staging.

Do not run legacy Terraform/Terragrunt apply commands or database reset/recreate commands from historical material. Any future self-hosted BTCPay deployment requires a new reviewed OpenSpec change and explicit authorization for the exact target resources.

Current gates:

- [`../TODO.md`](../TODO.md)
- [`../DEPLOYMENT_CHECKLIST.md`](../DEPLOYMENT_CHECKLIST.md)
- [`../docs/plans/railway-deployment-runbook.md`](../docs/plans/railway-deployment-runbook.md)
