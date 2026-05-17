#!/bin/bash

# Initialize database for Vela MMO game
echo "Initializing Vela database..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Create database if it doesn't exist
createdb vela || true

# Run the initialization script
node scripts/init-db.js

echo "Database initialized successfully!"
