# Upgrading

Releases are git tags (`vX.Y.Z`, [semantic versioning](https://semver.org)). Read the notes of
every version between yours and the target in [CHANGELOG.md](../CHANGELOG.md) before upgrading.

## Procedure

1. **Back up** the database and the uploads (see [SELF_HOSTING.md](SELF_HOSTING.md#backups)).
   Migrations only run forward: the backup is your way back.
2. **Fetch the new version**:

   ```bash
   git fetch --tags
   git checkout vX.Y.Z
   ```

3. **Compare your `.env`** with `.env.example` for new variables.
4. **Rebuild and restart**:

   ```bash
   docker compose up -d --build
   ```

   The `migrate` service applies the new migrations before `api` and `worker` start. Follow it with
   `docker compose logs migrate`; if it fails, the API does not start and your data is untouched
   by the failed migration (each migration runs in a transaction).

5. **Check** `docker compose ps` and sign in. Players' open tabs load the new web app on their next
   navigation (`index.html` is never cached; built assets have new names).

## Rolling back

Check out the previous tag, restore the backup taken in step 1
([Restore](SELF_HOSTING.md#restore)), then `docker compose up -d --build`. Starting an older version
on a database migrated by a newer one is not supported.

## Version notes

### 1.0.0

First stable release. Coming from a pre-release build: back up, then upgrade as above. Migrations
`0009_image_cache` and `0010_catalog_version` add database triggers, a one-row `catalog_state`
table and the `images.cache` setting; nothing to do by hand.
