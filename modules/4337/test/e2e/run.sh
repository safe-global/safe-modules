#!/usr/bin/env bash

bundler_container="bundler"

if [[ -n "$USE_UPSTREAM_BUNDLER" ]]; then
    bundler_container="bundler-upstream"
fi

docker compose up -d geth "$bundler_container"
# wait for containers to start up
SECONDS=0
until curl -fs http://localhost:8545 >/dev/null && curl -fs http://localhost:3000 >/dev/null; do
    if [[ $SECONDS -gt 30 ]]; then
        echo "ERROR: timeout waiting for local node and bundler to start"
        docker compose logs
        exit 1
    fi
    sleep 1
done

hardhat test --deploy-fixture --network localhost --grep '^E2E - '

docker compose down
