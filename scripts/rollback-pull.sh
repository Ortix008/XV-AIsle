#!/bin/sh
# Pull an older published sha and start it. Does not print environment values.
set -eu
export XV_PULL_ACTION=rollback
exec "$(dirname "$0")/deploy-pull.sh" "$@"
