#!/bin/bash
# Simple script to create snapshot files for migrations that are missing them
# Uses the latest existing snapshot as a template

LATEST=$(ls -t drizzle/meta/*_snapshot.json | head -1)
echo "Using template: $LATEST"

# Missing snapshots for these migrations
for num in 0022 0030 0031 0032 0033; do
    SQL_FILE=$(ls drizzle/${num}_*.sql 2>/dev/null | head -1)
    if [ -n "$SQL_FILE" ]; then
        BASE=$(basename "$SQL_FILE" .sql)
        SNAPSHOT="drizzle/meta/${BASE}_snapshot.json"
        if [ ! -f "$SNAPSHOT" ]; then
            echo "Creating: $SNAPSHOT"
            cp "$LATEST" "$SNAPSHOT"
        fi
    fi
done

echo "Done!"
