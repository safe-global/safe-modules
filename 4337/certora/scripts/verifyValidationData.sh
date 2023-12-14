#!/bin/bash

params=()

if [[ -n "$CI" ]]; then
    params=("--wait_for_results")
fi


certoraRun certora/conf/ValidationDataLastBitOne.conf \
    "${params[@]}" \
    --msg "Safe4337Module $*" \
    "$@"
