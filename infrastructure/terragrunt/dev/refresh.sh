#!/bin/bash
# Periodically run this to sync Terraform state with actual infrastructure

echo "🔄 Refreshing Terraform state with actual infrastructure..."
echo "This will detect any drift or manual changes made outside Terraform"
echo "================================================"

# Run a refresh-only operation to update state
terragrunt refresh

echo "================================================"
echo "✅ State refreshed! Now you can run normal applies with confidence."
echo ""
echo "Next steps:"
echo "1. Run 'terragrunt plan' to see if any drift was detected"
echo "2. Review any unexpected changes before applying"