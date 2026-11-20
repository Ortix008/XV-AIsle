#!/bin/sh
# Pull a published store image and start it. Does not print environment values.
set -eu

sha=${1:-}
case "$sha" in
  *[!0-9a-f]*)
    echo "usage: scripts/deploy-pull.sh <full sha>" >&2
    exit 2
    ;;
  "")
    echo "usage: scripts/deploy-pull.sh <full sha>" >&2
    exit 2
    ;;
esac
if [ "${#sha}" -ne 40 ]; then
  echo "usage: scripts/deploy-pull.sh <full sha>" >&2
  exit 2
fi

cd "$(dirname "$0")/.."

IMAGE_TAG="$sha" docker compose -p xvaisle pull store
IMAGE_TAG="$sha" docker compose -p xvaisle up -d

container=$(docker compose -p xvaisle ps -q store)
if [ -z "$container" ]; then
  echo "store container is not running" >&2
  exit 1
fi

image=$(docker inspect --format '{{.Image}}' "$container")
revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
if [ "$revision" != "$sha" ]; then
  echo "revision label does not match the requested sha" >&2
  exit 1
fi

code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://xvaisle.com)
if [ "$code" != "200" ]; then
  echo "https://xvaisle.com returned $code" >&2
  exit 1
fi

if [ "${XV_PULL_ACTION:-deploy}" = "rollback" ]; then
  echo "rolled back $sha"
else
  echo "deployed $sha"
fi
