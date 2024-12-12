#!/bin/bash

while true; do
  echo "Triggering process-reminders function..."
  curl -s http://127.0.0.1:54321/functions/v1/process-reminders
  echo -e "\nWaiting 60 seconds..."
  sleep 60
done 
