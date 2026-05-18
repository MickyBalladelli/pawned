# Vela MMO Chat Server

A real-time chat server for an MMO game built with Node.js, Express, and Socket.IO.

## Project Structure

```
vela/
├── server/              # Main server application
│   ├── server.js        # Main server file
│   ├── package.json     # Server dependencies
│   └── ...
├── client/              # Original HTML/JS client
│   └── index.html       # Original client interface
└── client-react/        # New React/MUI client
    ├── src/             # React source files
    ├── package.json     # React client dependencies
    └── ...
```

## Features

- Real-time messaging using Socket.IO
- Channel management (create, join, leave)
- User authentication simulation
- Private channel support
- Admin panel for channel management
- Responsive design

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Server Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm run dev
   ```

The server will be available at `http://localhost:3000`

### Client Setup

#### Original Client
The original HTML/JS client is available in the `client/` directory.

#### React Client
The new React/MUI client is available in the `client-react/` directory.

1. Navigate to the client directory:
   ```bash
   cd client-react
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the client:
   ```bash
   npm run dev
   ```

The React client will be available at `http://localhost:3000`

## Server API Endpoints

- `GET /api/channels` - Get all channels
- `POST /api/channels` - Create a new channel
- `GET /api/channels/:id/messages` - Get messages for a channel
- `POST /api/channels/:id/messages` - Send a message to a channel

## Technology Stack

- **Server**: Node.js, Express, Socket.IO
- **Database**: PostgreSQL
- **Client**: HTML/JS (original) and React/MUI (new)
- **Real-time Communication**: Socket.IO

## License

This project is licensed under the MIT License.
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up PostgreSQL database:
   - Make sure PostgreSQL is installed and running
   - Create a database named `vela`
   - Update database connection settings in `server/server.js` if needed
   - Run database initialization script:
     ```bash
     ./server/scripts/init-db.sh
     ```

4. Start the server:
   ```bash
   npm run dev
   ```

## Database Setup Instructions

If you don't have PostgreSQL installed:

### macOS (Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

### Ubuntu/Debian
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### CentOS/RHEL
```bash
sudo yum install postgresql-server postgresql-contrib
sudo systemctl start postgresql
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

For detailed database schema information, please refer to [DATABASE-SCHEMA.md](server/DATABASE-SCHEMA.md) in the server directory.

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
