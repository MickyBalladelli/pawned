# Vela MMO Database Schema

## Overview
The Vela MMO game server uses PostgreSQL for persistent storage of chat data. The database schema consists of three main tables: channels, users, and messages.

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

## Relationships

- **channels** ↔ **messages**: One-to-many (a channel can have many messages)
- **users** ↔ **messages**: One-to-many (a user can send many messages)

## Indexes

- `channels.name` - Unique index for channel names
- `messages.channel_id` - Index for efficient channel-based queries
- `messages.user_id` - Index for efficient user-based queries
- `messages.created_at` - Index for efficient time-based queries

## Initialization

The database tables are automatically created when the server starts if they don't exist. The initialization script also populates the database with sample data for testing purposes.