# Pawned

Pawned is a browser game/chat app with accounts, channels, admin tools, chess games, chess training, and live Socket.IO updates.

## Stack

- Client: React + Vite
- Server: Express + Socket.IO
- Database: PostgreSQL
- Production database: Aiven PostgreSQL

## Deployment

The app is split across hosts:

- **Vercel** hosts the client.
- **Render** hosts the Node server, REST API, and Socket.IO.
- **Aiven** hosts PostgreSQL.

Vercel should point API and socket traffic to Render:

```txt
PAWNED_API_ORIGIN=https://your-render-app.onrender.com
VITE_SOCKET_ORIGIN=https://your-render-app.onrender.com
```

Render needs:

```txt
DATABASE_URL=postgres://avnadmin:YOUR_PASSWORD@HOST:PORT/defaultdb?sslmode=require
DEFAULT_ADMIN_PASSWORD=your-admin-password
NODE_ENV=production
```

## Local Development

Local database URL lives in `.env`:

```txt
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pawned
```

Run database setup:

```sh
npm run init-db
```

Run server:

```sh
npm start
```

## Build

Build client:

```sh
npm --prefix client run build
```

Render server build:

```sh
npm --prefix server install
```

Render start:

```sh
npm --prefix server start
```
