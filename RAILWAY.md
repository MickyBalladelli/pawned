# Railway Deploy

Deploy from repo root.

Set Railway env:

```txt
DATABASE_URL=postgres://avnadmin:YOUR_PASSWORD@HOST:PORT/defaultdb?sslmode=require
DEFAULT_ADMIN_PASSWORD=choose-app-admin-password
NODE_ENV=production
```

Railway builds the client and starts the Express server. The server serves `client/dist` and Socket.IO from the same domain.

After first deploy, create tables:

```sh
railway run npm run init-db
```

Use the Railway app URL as full app URL.

If keeping frontend on Vercel, set Vercel env:

```txt
PAWNED_API_ORIGIN=https://your-railway-app.up.railway.app
VITE_SOCKET_ORIGIN=https://your-railway-app.up.railway.app
```
