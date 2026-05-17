#!/bin/bash

# Install script for Vela MMO game server

echo "Installing Vela MMO Server dependencies..."

# Install Node.js dependencies
npm install

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    echo "PostgreSQL is installed"
else
    echo "PostgreSQL is not installed. Please install PostgreSQL to continue."
    echo "On macOS: brew install postgresql"
    echo "On Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "On CentOS/RHEL: sudo yum install postgresql-server postgresql-contrib"
    exit 1
fi

echo "Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a PostgreSQL database named 'vela'"
echo "2. Update database connection settings in server/server.js if needed"
echo "3. Run 'npm start' to start the server"