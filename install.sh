#!/bin/bash

# Install script for Vela MMO game server
echo "Installing Vela MMO Server..."

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
cd server
npm install

echo "Installation complete!"
echo "Please make sure PostgreSQL is running and create a database named 'vela'"
echo "Then run: ./server/scripts/init-db.sh to initialize the database"