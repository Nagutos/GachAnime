# GachAnime

An open-source, self-hostable anime character card collecting game, made to be played with
friends: open free boosters on a timer, collect characters from your favorite series, recycle
duplicates for gems, trade and sell cards, complete missions and achievements, and unlock each
character's wiki page.

> Status: early development (Phase 1 — catalog and AniList import done). See
> [docs/ROADMAP.md](docs/ROADMAP.md).

## Self-hosting

Requirements: Docker with Compose, and a Discord application for sign-in.

1. **Create a Discord application** at <https://discord.com/developers/applications>.
   In _OAuth2_, copy the client id and secret and add the redirect URL
   `<PUBLIC_URL>/api/auth/callback/discord` (e.g. `http://localhost:8080/api/auth/callback/discord`).
2. **Configure**: `cp .env.example .env`, then fill at least `PUBLIC_URL`, `BETTER_AUTH_SECRET`
   (`openssl rand -base64 32`), `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `POSTGRES_PASSWORD`
   and `ADMIN_DISCORD_IDS` (your Discord user id, to become admin at first sign-in).
3. **Start**: `docker compose up -d`, then open `PUBLIC_URL` (default <http://localhost:8080>).
4. **Fill the catalog**: sign in, open _Administration → AniList import_ and start an import of the
   most popular anime (500 by default, with their whole franchises). AniList currently allows about
   30 requests per minute, so the first full import takes a few hours; it runs in the `worker`
   container and resumes where it stopped after a restart. You can also import single anime from
   the AniList search, or add series AniList does not cover (games…) by hand or with a JSON roster.
   Command-line alternative:
   `docker compose run --rm -w /app/packages/importer worker node --import tsx src/cli/import-anilist.ts --top 500`

Migrations run automatically at startup. To serve HTTPS directly, set `SITE_ADDRESS` to your domain
and expose ports 80/443 (`HTTP_PORT=80`, `HTTPS_PORT=443`); Caddy obtains the certificate.

## Development

Requirements: Node.js ≥ 24, pnpm 12, Docker.

```bash
pnpm install
cp .env.example .env          # set PUBLIC_URL=http://localhost:5173 and fill the secrets
docker compose -f docker-compose.dev.yml up -d   # postgres :5433 (+ test db), redis :6380
pnpm db:migrate
pnpm dev                      # web http://localhost:5173, api :3000, worker
```

| Command                                   | Purpose                                                |
| ----------------------------------------- | ------------------------------------------------------ |
| `pnpm lint`                               | ESLint (including the "no raw UI text" i18n rule)      |
| `pnpm typecheck`                          | TypeScript in every package                            |
| `pnpm test`                               | Vitest (DB integration tests need `TEST_DATABASE_URL`) |
| `pnpm test:e2e`                           | Playwright                                             |
| `pnpm i18n:check`                         | Missing / extra translation keys between languages     |
| `pnpm db:generate`                        | New SQL migration from the Drizzle schema              |
| `pnpm admin:promote -- --discord-id <id>` | Grant the admin role                                   |
| `pnpm import:anilist -- --top 500`        | AniList import (`--ids 1,2`, `--resume <job id>`)      |

Architecture, game design and decisions are documented in [`docs/`](docs). Contributions must keep
the code, comments and docs in English; the UI is translated (`apps/web/src/locales`, adding a
language = adding a JSON file).

## Images and data

Character and series data come from [AniList](https://anilist.co) and are credited in the game.
**Images belong to their respective copyright holders.** GachAnime does not distribute them; each
instance loads them from AniList (or caches them locally if enabled). The person hosting an
instance is responsible for how these images are used on it.

## License

[GNU AGPL-3.0](LICENSE). If you run a modified version as a public service, you must publish your
changes under the same license.
