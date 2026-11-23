# Pull deploy

The store image is built in GitHub Actions, not on the droplet. A pull request builds the Dockerfile and does not push. That job is the pull request's "image built in CI" check. A push to `main` pushes `ghcr.io/ortix008/xv-aisle-store:<full sha>` and `:main`.

The image workflow also accepts a `workflow_dispatch` input named `sha`. That run checks out the given commit and pushes only `ghcr.io/ortix008/xv-aisle-store:<sha>`. It does not move the `:main` tag. The current production commit, `9165ed063b8b7b0ff412b1353d6d397bf442baf2`, is published that way.

The GHCR package is private by default. The repository is public. XO can either make that package public once, or give the droplet a read-only token. This repository does not do either, and a deploy does not change the package visibility.

`DEPLOYED_COMMIT` is the git sha for the image. The image build sets it three ways: the OCI label `org.opencontainers.image.revision`, the `DEPLOYED_COMMIT` environment variable, and the file `/app/DEPLOYED_COMMIT`. If the app reads `DEPLOYED_COMMIT`, it uses the environment variable when that is set, and the file when the variable is empty.

## Runtime keys

The published image does not carry the Next preview or server-action keys. The build writes the placeholder `placeholder` into `.next/prerender-manifest.json` and `.next/server/server-reference-manifest.json`. At container start, `scripts/docker-entrypoint.mjs` rewrites these fields from the environment:

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` fills `encryptionKey`
- `__NEXT_PREVIEW_MODE_ID` fills `previewModeId`
- `__NEXT_PREVIEW_MODE_SIGNING_KEY` fills `previewModeSigningKey`
- `__NEXT_PREVIEW_MODE_ENCRYPTION_KEY` fills `previewModeEncryptionKey`

Leave them empty to generate an ephemeral key for that start. Production values are set on the droplet later. The script does not print them. `.env.example` lists the names with empty values.

## Deploy a sha

On the droplet, from this checkout:

```sh
scripts/deploy-pull.sh <full sha>
```

Before it switches the store, it records the running revision in `/root/xvaisle/.deploy-state` as `current=` and `previous=`. It then runs `IMAGE_TAG=<sha> docker compose -p xvaisle pull store`, then `up -d`.

The health check retries for about 90 seconds (2, 4, 8, 16, 30, then 30 seconds). Each try requires `https://xvaisle.com` to return 200 and the running image's `org.opencontainers.image.revision` label to equal the target sha. If that never happens, the script rolls back to the previous sha, checks health again, and exits nonzero. The script does not print `.env`.

`docker-compose.yml` keeps `build: .` for the store service. If the registry image cannot be pulled, the old path is still `docker compose build` and `docker compose up -d` on the droplet. Building there can run out of memory on the 1GB machine. Stop the store before that build if you have to use it.

## Roll back

```sh
scripts/rollback-pull.sh
scripts/rollback-pull.sh <full sha>
```

With no argument, this reads `previous=` from `/root/xvaisle/.deploy-state`. With an argument, it pulls that sha instead. It uses the same health checks. A failed rollback does not start another rollback.
