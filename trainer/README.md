# Vela Trainer Server

Separate local process for chess RL training.

Run from repo root:

```sh
node trainer/server.js
```

Default URL:

```txt
http://127.0.0.1:6060
```

Main app server proxies admin-only `/api/rl-training/*` requests to this process.

Environment:

- `TRAINER_HOST`: bind host, default `127.0.0.1`
- `TRAINER_PORT`: bind port, default `6060`
- `TRAINER_URL`: app server proxy target, default `http://127.0.0.1:6060`

Routes:

- `GET /health`
- `GET /job`
- `POST /job`
- `POST /job/stop`
- `POST /job/stop-all`
