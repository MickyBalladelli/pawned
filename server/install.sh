#!/bin/bash

# Install script for Vela MMO game server

echo "Installing Vela MMO Server dependencies..."

# Install Node.js dependencies
npm install

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a PostgreSQL database named 'vela'"
echo "2. Update database connection settings in server/server.js if needed"
echo "3. Run 'npm start' to start the server"