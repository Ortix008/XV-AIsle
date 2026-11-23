#!/bin/sh
# Pull a published store image and start it. Does not print environment values.
set -eu

state=${XV_DEPLOY_STATE:-/root/xvaisle/.deploy-state}

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

running_sha() {
  container=$(docker compose -p xvaisle ps -q store 2>/dev/null || true)
  if [ -z "$container" ]; then
    return 0
  fi
  image=$(docker inspect --format '{{.Image}}' "$container")
  docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true
}

write_state() {
  current=$1
  previous=$2
  mkdir -p "$(dirname "$state")"
  printf 'current=%s\nprevious=%s\n' "$current" "$previous" > "$state"
}

healthy() {
  target=$1
  container=$(docker compose -p xvaisle ps -q store 2>/dev/null || true)
  if [ -z "$container" ]; then
    return 1
  fi
  image=$(docker inspect --format '{{.Image}}' "$container")
  revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
  if [ "$revision" != "$target" ]; then
    return 1
  fi
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 https://xvaisle.com || echo 000)
  [ "$code" = "200" ]
}

wait_healthy() {
  target=$1
  if healthy "$target"; then
    return 0
  fi
  for delay in 2 4 8 16 30 30; do
    sleep "$delay"
    if healthy "$target"; then
      return 0
    fi
  done
  return 1
}

old=$(running_sha || true)
if [ -n "$old" ]; then
  write_state "$old" "$old"
fi

IMAGE_TAG="$sha" docker compose -p xvaisle pull store
IMAGE_TAG="$sha" docker compose -p xvaisle up -d

if wait_healthy "$sha"; then
  write_state "$sha" "$old"
  if [ "${XV_PULL_ACTION:-deploy}" = "rollback" ]; then
    echo "rolled back $sha"
  else
    echo "deployed $sha"
  fi
  exit 0
fi

echo "https://xvaisle.com did not stay healthy on $sha" >&2
if [ "${XV_PULL_ACTION:-deploy}" = "rollback" ] || [ -z "$old" ] || [ "$old" = "$sha" ]; then
  echo "no further rollback was started" >&2
  exit 1
fi

echo "rolling back to $old" >&2
if XV_PULL_ACTION=rollback "$0" "$old"; then
  echo "rolled back to $old after $sha failed" >&2
else
  echo "rollback to $old did not become healthy" >&2
fi
exit 1
