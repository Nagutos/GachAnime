# Self-hosting guide

GachAnime runs as one Docker Compose stack. It is designed for a group of friends: a small VPS or
a home server is enough.

| Service    | Role                                                                  |
| ---------- | --------------------------------------------------------------------- |
| `web`      | Caddy: serves the web app and `/media`, proxies `/api`, optional TLS  |
| `api`      | Next.js API (game rules, sign-in)                                     |
| `worker`   | Background jobs: AniList imports, pack pools, expiries, image cache   |
| `migrate`  | Runs the database migrations at every start, then exits               |
| `postgres` | PostgreSQL 17: **all game data** (the only thing you must back up)    |
| `redis`    | Sessions, rate limits and job queue (losing it only signs people out) |

## Requirements

- Docker with Compose v2, on Linux (x86_64 or arm64).
- 1 vCPU and 1 GB of RAM are enough for a few dozen players; 2 GB recommended while a big AniList
  import runs.
- Disk: about 1 GB for the database with the top 500 catalog, plus ~15 KB per character if the
  image cache is enabled (≈ 500 MB for 30 000 characters).
- A Discord application (players sign in with Discord only).
- Optional: a domain name pointing to the server, for HTTPS.

## Installation

1. **Get the code** of the latest release:

   ```bash
   git clone https://github.com/Nagutos/GachAnime.git && cd GachAnime
   git checkout v1.0.0
   ```

2. **Create a Discord application** at <https://discord.com/developers/applications>. In
   _OAuth2_, copy the client id and secret, and add the redirect URL
   `<PUBLIC_URL>/api/auth/callback/discord`.

3. **Configure**: `cp .env.example .env`, then set at least:

   | Variable                                      | Value                                                                      |
   | --------------------------------------------- | -------------------------------------------------------------------------- |
   | `PUBLIC_URL`                                  | The URL players type, e.g. `https://gacha.example.com` (no trailing slash) |
   | `BETTER_AUTH_SECRET`                          | `openssl rand -base64 32`                                                  |
   | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | From step 2                                                                |
   | `POSTGRES_PASSWORD`                           | A long random password                                                     |
   | `ADMIN_DISCORD_IDS`                           | Your Discord user id: you become admin at your first sign-in               |
   | `SITE_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT`     | See [HTTPS](#https) below                                                  |

   `PUBLIC_URL` must match the address in the browser exactly, otherwise sign-in fails with
   "Invalid origin".

4. **Start**: `docker compose up -d --build`. The first build takes a few minutes. Check with
   `docker compose ps` that `api` is healthy, then open `PUBLIC_URL`.

5. **Fill the catalog**: sign in, open _Admin → Catalog import_ and import the most popular anime
   (500 by default, each with its whole franchise). AniList allows about 30 requests per minute,
   so a full import takes a few hours. It runs in the `worker` and resumes after a restart. You can
   also import single anime, video games from IGDB (see below), or add series no source covers by
   hand or with a JSON roster.

6. **Tune the game** in the admin area: booster timers and caps, rarity thresholds (_Rarities_
   shows how many characters fall into each rarity), packs, missions, achievements, market limits.

## Video games (IGDB, optional)

Video game characters come from [IGDB](https://www.igdb.com), free for non-commercial use. IGDB
authenticates through Twitch, so each instance uses its own Twitch application:

1. Sign in at <https://dev.twitch.tv/console/apps> (enable two-factor authentication on the Twitch
   account if asked) and register an application: any name, OAuth redirect URL
   `http://localhost`, category _Website Integration_, client type _Confidential_.
2. Copy its **Client ID**, generate a **New Secret**, and set them in `.env`:
   `IGDB_CLIENT_ID=…` and `IGDB_CLIENT_SECRET=…`.
3. `docker compose up -d` (the API and the worker read them at start).
4. In _Admin → Catalog import_, choose _Video games (IGDB)_: import the most rated games (200 by
   default, a few minutes) or search for specific games. Games of the same IGDB series form one
   series; only characters with a portrait are imported.
5. Tune the _Game ratings ≥_ thresholds in _Admin → Rarities_: a game character's default rarity
   comes from the number of IGDB ratings of its most popular game.

The free boosters then include a _Video games_ pack (and an _Anime_ one).

## HTTPS

Pick one:

- **Caddy handles TLS** (simplest): point your domain to the server, then set
  `SITE_ADDRESS=gacha.example.com`, `HTTP_PORT=80`, `HTTPS_PORT=443` and
  `PUBLIC_URL=https://gacha.example.com`. Caddy obtains and renews the certificate (stored in the
  `caddy-data` volume).
- **Your own reverse proxy** (nginx, Traefik, an existing Caddy…): keep `SITE_ADDRESS=:80`, set
  `HTTP_PORT` to a local port and proxy your domain to it. Forward the `Host` header and keep the
  proxy's request body limit at 10 MB or more (image uploads).

The stack sends a strict Content-Security-Policy and HSTS (once served over HTTPS). Do not serve
the instance over plain HTTP on the Internet: session cookies would travel unencrypted.

## Images

Character pictures come from AniList's CDN. With _Admin → Settings → Image cache_ enabled, the
worker downloads them into the `uploads` volume (every 15 minutes, a few minutes per run, until
everything is cached), so players never contact AniList. Images uploaded by admins (manual series)
are always stored locally. To reclaim the space of the cache, disable it, stop the stack and
delete `cache/` inside the `uploads` volume:
`docker run --rm -v gachanime_uploads:/data alpine rm -rf /data/cache`, then clear the paths in
the database (`UPDATE characters SET image_path = NULL WHERE image_path LIKE 'cache/%'` and the
same for `series.cover_upload_path`).

## Command-line tools

The admin area covers day-to-day tasks. A few CLIs exist for automation or recovery; they run in
the `worker` image, from the package that owns them:

```bash
# Grant the admin role to a player who already signed in once
docker compose run --rm -w /app/packages/core worker \
  node --import tsx src/cli/admin-promote.ts --discord-id 123456789012345678

# Give (or, with a negative amount, remove) gems; audited
docker compose run --rm -w /app/packages/core worker \
  node --import tsx src/cli/grant-gems.ts --discord-id 123456789012345678 --amount 500 --note gift

# AniList import from the command line (--top 500, --ids 16498,1535 or --resume <job id>)
docker compose run --rm -w /app/packages/importer worker \
  node --import tsx src/cli/import-anilist.ts --top 500
```

## Backups

Everything that matters is in PostgreSQL and in the `uploads` volume (admin uploads and the image
cache, which can be rebuilt). Redis holds nothing that needs a backup.

```bash
# Database (compressed custom format; consistent while the game runs)
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
  > "gachanime-$(date +%F).dump"

# Uploaded images
docker run --rm -v gachanime_uploads:/data:ro -v "$PWD":/backup alpine \
  tar czf "/backup/gachanime-uploads-$(date +%F).tar.gz" -C /data .
```

Run them daily (cron or a systemd timer) and copy the files off the server. Keep the `.env` file
too: without `BETTER_AUTH_SECRET` existing sessions are lost (players simply sign in again), and
without `POSTGRES_PASSWORD` you cannot reconnect to the existing database volume.

The volume names are prefixed with the Compose project name (`gachanime` by default); check them
with `docker volume ls`.

## Restore

```bash
docker compose stop web api worker
docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --single-transaction' \
  < gachanime-2026-10-08.dump
docker run --rm -v gachanime_uploads:/data -v "$PWD":/backup:ro alpine \
  tar xzf /backup/gachanime-uploads-2026-10-08.tar.gz -C /data
docker compose up -d
```

To move to a new server: install as above with the same `.env`, run `docker compose up -d
postgres`, restore, then `docker compose up -d`. A backup can only be restored on the same or a
newer GachAnime version (migrations run forward at start-up).

## Upgrades

See [UPGRADING.md](UPGRADING.md).

## Monitoring and troubleshooting

- `docker compose ps`: `api` and the databases report their health; `GET /api/v1/health` returns
  `{"status":"ok"}` when the API reaches Postgres and Redis.
- `docker compose logs -f api worker`: JSON logs (pino). Set `LOG_LEVEL=debug` in `.env` for more.
- **"Invalid origin" at sign-in**: `PUBLIC_URL` differs from the browser address (scheme, host or
  port).
- **Discord says the redirect URI is invalid**: add `<PUBLIC_URL>/api/auth/callback/discord` in the
  Discord application.
- **Imports stop with AniList errors**: AniList is down or rate-limiting; resume the import from
  _Admin → AniList import_ later.
- **Everyone is signed out after a restart**: Redis lost its data (sessions live there). The
  `redis-data` volume keeps them across normal restarts.
