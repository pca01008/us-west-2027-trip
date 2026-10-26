#!/usr/bin/env bash
# Run in a Linux checkout with its own node_modules, never shared Windows packages.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$PWD" == /mnt/* ]]; then echo 'Use a Linux filesystem checkout; do not share Windows node_modules.' >&2; exit 1; fi
. /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 ]]; then echo 'Ubuntu 24.04 is required; see docs/OPERATIONS.md#validation.' >&2; exit 1; fi
for command in node npm docker; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
[[ "$(node -p process.versions.node)" == "$(cat .node-version)" ]] || { echo 'Select the checked-in Node version first.' >&2; exit 1; }
[[ "$(npm --version)" == "$(node -p 'require("./package.json").packageManager.slice(4)')" ]] || { echo 'Select the checked-in npm version first.' >&2; exit 1; }
npm ci
npx playwright install chromium firefox webkit
run_id="trip-check-$$-$RANDOM"
container=''
diagnostics="$(mktemp -d -t westbound-postgres-XXXXXX)"
cleanup(){
  status=$?
  trap - EXIT
  if [[ -n "$container" ]]; then
    if [[ "$status" != 0 ]]; then docker logs "$container" >"$diagnostics/postgres.log" 2>&1 || true; fi
    if [[ "$(docker inspect --format '{{ index .Config.Labels "trip.validation" }}' "$container" 2>/dev/null)" == "$run_id" ]]; then
      docker rm -f "$container" >/dev/null || { echo "Cleanup failed: owned container $container remains" >&2; status=1; }
    fi
  fi
  echo "SQL diagnostics: $diagnostics; owned container: ${container:-not started}"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
container="$(docker run --rm -d --name "$run_id" --label "trip.validation=$run_id" -e POSTGRES_PASSWORD=trip-sql-local-only -p 127.0.0.1::5432 postgres:17)"
echo "Disposable SQL container: $container ($run_id). Forced termination may require docker rm -f $container."
ready=false
for ((attempt=0;attempt<30;attempt++)); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Disposable PostgreSQL did not become ready.' >&2; exit 1; }
address="$(docker port "$container" 5432/tcp)"
[[ "$address" =~ ^127\.0\.0\.1:([0-9]+)$ ]] || { echo 'Unexpected PostgreSQL binding.' >&2; exit 1; }
export TRIP_SQL_TEST_URL="postgresql://postgres:trip-sql-local-only@127.0.0.1:${BASH_REMATCH[1]}/postgres"
npm run test:ci
