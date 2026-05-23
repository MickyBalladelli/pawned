# Vela MMO Database Schema

## Overview
The Vela MMO game server uses PostgreSQL for persistent storage of chat and chess data.

## Tables

### channels
Stores information about chat channels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier for the channel |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Name of the channel |
| description | TEXT | | Description of the channel |
| is_private | BOOLEAN | DEFAULT FALSE | Whether the channel is private |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the channel was created |

### users
Stores information about users in the game.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier for the user |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Username of the user |
| password_hash | TEXT | | Hashed password for authentication |
| is_admin | BOOLEAN | DEFAULT FALSE | Whether the user has admin privileges |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the user was created |

### messages
Stores chat messages sent in channels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier for the message |
| channel_id | INTEGER | REFERENCES channels(id) ON DELETE CASCADE | Channel the message belongs to |
| user_id | INTEGER | REFERENCES users(id) ON DELETE CASCADE | User who sent the message |
| content | TEXT | NOT NULL | Content of the message |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the message was sent |

### chess_games
Stores chess game state.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier for the game |
| white_user_id | INTEGER | REFERENCES users(id) ON DELETE SET NULL | White player |
| black_user_id | INTEGER | REFERENCES users(id) ON DELETE SET NULL | Black player |
| fen | TEXT | NOT NULL | Current board state |
| status | VARCHAR(20) | DEFAULT waiting | Game status |
| turn_color | VARCHAR(10) | DEFAULT white | Player color to move |
| winner_user_id | INTEGER | REFERENCES users(id) ON DELETE SET NULL | Winner, when game has one |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the game was created |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the game last changed |
| ended_at | TIMESTAMP | | When the game ended |

### chess_moves
Stores chess move history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier for the move |
| game_id | INTEGER | REFERENCES chess_games(id) ON DELETE CASCADE | Game the move belongs to |
| user_id | INTEGER | REFERENCES users(id) ON DELETE SET NULL | User who moved |
| move_number | INTEGER | NOT NULL | Move sequence number |
| color | VARCHAR(10) | NOT NULL | Player color |
| san | TEXT | NOT NULL | Standard algebraic notation |
| from_square | VARCHAR(2) | NOT NULL | Source square |
| to_square | VARCHAR(2) | NOT NULL | Target square |
| promotion | VARCHAR(1) | | Promotion piece |
| fen_after | TEXT | NOT NULL | Board state after move |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the move was made |

## Relationships

- **channels** ↔ **messages**: One-to-many (a channel can have many messages)
- **users** ↔ **messages**: One-to-many (a user can send many messages)
- **users** ↔ **chess_games**: One-to-many by white, black, and winner user ids
- **chess_games** ↔ **chess_moves**: One-to-many (a game can have many moves)

## Indexes

- `channels.name` - Unique index for channel names
- `messages.channel_id` - Index for efficient channel-based queries
- `messages.user_id` - Index for efficient user-based queries
- `messages.created_at` - Index for efficient time-based queries
- `chess_games.white_user_id` - Index for user game lookups
- `chess_games.black_user_id` - Index for user game lookups
- `chess_games.status` - Index for open game lookups
- `chess_moves.game_id` - Index for move history lookups

## Initialization

The database tables are automatically created when the server starts if they don't exist. The initialization script also populates the database with sample data for testing purposes.

The initialization script is located at `scripts/init-db.js` in the server directory.
