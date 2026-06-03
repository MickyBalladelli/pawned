#!/bin/bash

# Install script for Pawned MMO game server

echo "Installing Pawned MMO Server dependencies..."

# Install Node.js dependencies
npm install

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a PostgreSQL database named 'pawned'"
echo "2. Update database connection settings in server/server.js if needed"
echo "3. Run 'npm run dev' to start the server"