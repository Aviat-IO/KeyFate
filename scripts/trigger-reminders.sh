#!/bin/bash

# Dynamically get the service role key from supabase status
SERVICE_ROLE_KEY=$(supabase status | grep "service_role key:" | awk '{print $3}')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: Could not get service_role key from supabase status. Make sure Supabase is running."
  exit 1
fi

echo "Using service_role key: ${SERVICE_ROLE_KEY:0:20}..."

while true; do
  echo "Triggering process-reminders function..."
  curl -s -H "Authorization: Bearer $SERVICE_ROLE_KEY" http://127.0.0.1:54321/functions/v1/process-reminders

  echo -e "\nTriggering check-secrets function..."
  curl -s -H "Authorization: Bearer $SERVICE_ROLE_KEY" http://127.0.0.1:54321/functions/v1/check-secrets

  echo -e "\nWaiting 60 seconds..."
  sleep 60
done
