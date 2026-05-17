# Vela MMO Game Server

A real-time chat server for the Vela MMO game built with Node.js, Socket.IO, and PostgreSQL.

## Features

- Real-time messaging using Socket.IO
- Multi-channel chat system
- Admin panel for managing channels
- PostgreSQL database integration
- Responsive web interface

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up PostgreSQL database:
   - Create a database named `vela`
   - Update database connection settings in `server/server.js` if needed
   - Run database initialization script:
     ```bash
     ./server/scripts/init-db.sh
     ```

4. Start the server:
   ```bash
   npm start
   ```

## API Endpoints

### Channels
- `GET /api/channels` - Get all channels
- `POST /api/channels` - Create a new channel
- `PUT /api/channels/:id` - Update a channel
- `DELETE /api/channels/:id` - Delete a channel

### Messages
- `GET /api/channels/:id/messages` - Get messages for a channel

## Database Schema

The server automatically creates the following tables:

### channels
- id (SERIAL PRIMARY KEY)
- name (VARCHAR(100) UNIQUE NOT NULL)
- description (TEXT)
- is_private (BOOLEAN DEFAULT FALSE)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### users
- id (SERIAL PRIMARY KEY)
- username (VARCHAR(50) UNIQUE NOT NULL)
- password_hash (TEXT)
- is_admin (BOOLEAN DEFAULT FALSE)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### messages
- id (SERIAL PRIMARY KEY)
- channel_id (INTEGER REFERENCES channels(id) ON DELETE CASCADE)
- user_id (INTEGER REFERENCES users(id) ON DELETE CASCADE)
- content (TEXT NOT NULL)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

## Socket Events

### Client to Server
- `joinChannel(channelId)` - Join a channel
- `leaveChannel(channelId)` - Leave a channel
- `sendMessage(data)` - Send a message to a channel

### Server to Client
- `receiveMessage(message)` - Receive a message
- `channelCreated(channel)` - New channel created
- `channelUpdated(channel)` - Channel updated
- `channelDeleted(channelId)` - Channel deleted

## License

MIT