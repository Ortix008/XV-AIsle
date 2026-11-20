# Pull deploy

The store image is built in GitHub Actions, not on the droplet. A pull request builds the Dockerfile and does not push. That job is the pull request's "image built in CI" check. A push to `main` pushes `ghcr.io/ortix008/xv-aisle-store:<full sha>` and `:main`.

The GHCR package is private by default. The repository is public. XO can either make that package public once, or give the droplet a read-only token. This repository does not do either.

`DEPLOYED_COMMIT` is the git sha for the image. The image build sets it three ways: the OCI label `org.opencontainers.image.revision`, the `DEPLOYED_COMMIT` environment variable, and the file `/app/DEPLOYED_COMMIT`. If the app reads `DEPLOYED_COMMIT`, it uses the environment variable when that is set, and the file when the variable is empty.

## Deploy a sha

On the droplet, from this checkout:

```sh
scripts/deploy-pull.sh <full sha>
```

That runs `IMAGE_TAG=<sha> docker compose -p xvaisle pull store`, then `up -d`. It then checks that the running image's `org.opencontainers.image.revision` label equals the sha, and that `https://xvaisle.com` returns 200. The script does not print `.env`.

`docker-compose.yml` keeps `build: .` for the store service. If the registry image cannot be pulled, the old path is still `docker compose build` and `docker compose up -d` on the droplet. Building there can run out of memory on the 1GB machine. Stop the store before that build if you have to use it.

## Roll back

```sh
scripts/rollback-pull.sh <full sha>
```

This pulls that sha and starts it, with the same revision and homepage checks. The commit that was live before the pull-deploy change is `9165ed063b8b7b0ff412b1353d6d397bf442baf2`. That image is not in GHCR until one is pushed for it. Until then, check out that commit on the droplet and use the build path above.
