#!/bin/bash

params=()

if [[ -n "$CI" ]]; then
    params=("--wait_for_results")
fi

certoraRun certora/conf/Safe4337Module.conf \
    "${params[@]}" \
    "$@"

