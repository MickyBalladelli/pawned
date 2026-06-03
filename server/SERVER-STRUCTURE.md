# Pawned MMO Server Structure

## Overview
This is a real-time chat server for the Pawned MMO game, built with Node.js, Express, Socket.IO, and PostgreSQL.

## Directory Structure

```
pawned/
├── server/
│   ├── server.js          # Main server implementation
│   ├── package.json       # Node.js dependencies
│   ├── DATABASE-SCHEMA.md # Database schema documentation
│   ├── SERVER-STRUCTURE.md # Server structure documentation
│   ├── scripts/
│   │   ├── init-db.js     # Database initialization script
│   │   └── init-db.sh     # Database initialization shell script
│   ├── test-setup.js      # Setup verification script
│   └── images/            # Client images
├── client/
│   └── index.html         # Client-side chat interface
└── install.sh             # Installation script
```

## Server Implementation Details

### Main Server (server/server.js)
- Uses Express.js for HTTP routing
- Implements Socket.IO for real-time communication
- Integrates with PostgreSQL database
- Runs on port 4000
- Provides REST API endpoints for channels and messages
- Provides REST API endpoints for chess games and moves
- Handles user authentication and session management

### Database Schema
The server automatically creates three tables:
1. **channels** - Stores chat channels
2. **users** - Stores user information
3. **messages** - Stores chat messages
4. **chess_games** - Stores chess game state
5. **chess_moves** - Stores move history

### Client Interface (client/index.html)
- Responsive web interface
- Real-time chat functionality
- Channel management
- Message history display

## Features Implemented

1. **Real-time Messaging**
   - Instant message delivery using Socket.IO
   - Channel-based communication
   - Message timestamps

2. **Channel Management**
   - Create, update, and delete channels
   - Private and public channels
   - Channel listing and selection

3. **Database Integration**
   - PostgreSQL for persistent storage
   - Automatic table creation
   - Data validation and error handling

4. **Admin Panel**
   - Channel creation interface
   - User management (planned)

## How to Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure PostgreSQL is running and create a database named "pawned"

3. Start the server:
   ```bash
   npm run dev
   ```

4. Access the chat interface at:
   ```
   http://localhost:3000
   ```

## API Endpoints

### Channels
- `GET /api/channels` - Get all channels
- `POST /api/channels` - Create a new channel
- `PUT /api/channels/:id` - Update a channel
- `DELETE /api/channels/:id` - Delete a channel

### Messages
- `GET /api/channels/:id/messages` - Get messages for a channel

### Chess
- `GET /api/chess/games` - Get your chess games
- `GET /api/chess/games?scope=open` - Get open chess games
- `GET /api/chess/games?scope=active` - Get live chess games for viewing
- `GET /api/chess/games?scope=completed` - Get completed chess games
- `POST /api/chess/games` - Create a chess game
- `POST /api/chess/bot-games` - Create a chess game against PawnedBot
- `GET /api/chess/bot-levels` - Get supported bot levels
- `GET /api/chess/openings` - Get the opening book
- `GET /api/chess/games/:id` - Get a chess game and moves
- `POST /api/chess/games/:id/join` - Join an open chess game
- `POST /api/chess/games/:id/moves` - Make a move
- `POST /api/chess/games/:id/resign` - Resign a game
- `POST /api/chess/games/:id/cancel` - Cancel a waiting game
- `POST /api/chess/games/:id/close-chat` - Close the game chat after game ends
- `DELETE /api/chess/games/:id` - Mark a completed game deleted as admin or creator

## Socket Events

### Client to Server
- `joinChannel(channelId)` - Join a channel
- `leaveChannel(channelId)` - Leave a channel
- `sendMessage(data)` - Send a message to a channel
- `chess:joinGame(gameId)` - Join a chess game room
- `chess:leaveGame(gameId)` - Leave a chess game room
- `chess:move(data)` - Make a chess move
- `chess:resign(data)` - Resign a chess game
- `chess:cancel(data)` - Cancel a waiting chess game

### Server to Client
- `receiveMessage(message)` - Receive a message
- `channelCreated(channel)` - New channel created
- `channelUpdated(channel)` - Channel updated
- `channelDeleted(channelId)` - Channel deleted
- `chess:moveMade(result)` - Chess move accepted
- `chess:gameUpdated(game)` - Chess game state changed
