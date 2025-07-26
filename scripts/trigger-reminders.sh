#!/bin/bash

# Dynamically get the anon key from supabase status
ANON_KEY=$(supabase status | grep "anon key:" | awk '{print $3}')

if [ -z "$ANON_KEY" ]; then
  echo "Error: Could not get anon key from supabase status. Make sure Supabase is running."
  exit 1
fi

echo "Using anon key: ${ANON_KEY:0:20}..."

while true; do
  echo "Triggering process-reminders function..."
  curl -s -H "Authorization: Bearer $ANON_KEY" http://127.0.0.1:54321/functions/v1/process-reminders

  echo -e "\nTriggering check-secrets function..."
  curl -s -H "Authorization: Bearer $ANON_KEY" http://127.0.0.1:54321/functions/v1/check-secrets

  echo -e "\nWaiting 60 seconds..."
  sleep 60
done
