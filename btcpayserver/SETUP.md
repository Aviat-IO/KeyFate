# BTCPay Server Database Setup (Historical)

> **Legacy GCP reference only.** This file is not a current production procedure. KeyFate's supported application platform is Railway, and the current release does not deploy a repository-managed BTCPay Server database.

The former document contained Cloud SQL credentials, broad database grants, and drop/recreate troubleshooting commands. They were removed because destructive database recovery is not an acceptable production procedure.

For local experimentation, use an isolated disposable PostgreSQL database that contains no KeyFate, staging, production, or customer data. Do not reuse the application database or its credentials.

Any future managed BTCPay deployment requires a separate reviewed change that defines:

- a dedicated service and least-privilege database role;
- verified TLS and secret injection;
- generated migrations or the upstream BTCPay-supported lifecycle;
- isolated backup/restore evidence;
- monitoring, retention, upgrade, and rollback owners; and
- explicit approval before any external resource mutation.

Current provider configuration and evidence gates are in [`../TODO.md`](../TODO.md) and [`../DEPLOYMENT_CHECKLIST.md`](../DEPLOYMENT_CHECKLIST.md).
