#!/bin/sh
# Pull the previous published sha, or an explicit one, and start it.
# Does not print environment values.
set -eu

state=${XV_DEPLOY_STATE:-/root/xvaisle/.deploy-state}
sha=${1:-}

if [ -z "$sha" ]; then
  if [ ! -f "$state" ]; then
    echo "usage: scripts/rollback-pull.sh [full sha]" >&2
    exit 2
  fi
  sha=$(sed -n 's/^previous=//p' "$state" | head -n 1)
fi

case "$sha" in
  *[!0-9a-f]* | "")
    echo "no previous sha is recorded" >&2
    exit 2
    ;;
esac
if [ "${#sha}" -ne 40 ]; then
  echo "usage: scripts/rollback-pull.sh [full sha]" >&2
  exit 2
fi

export XV_PULL_ACTION=rollback
exec "$(dirname "$0")/deploy-pull.sh" "$sha"
