#!/bin/bash

params=("--send_only")

if [[ -n "$CI" ]]; then
    params=()
fi

certoraRun certora/conf/Safe4337Module.conf \
    "${params[@]}" \
    --msg "Safe4337Module $*" \
    "$@"

certoraRun certora/conf/PayForMissingFunds.conf \
    "${params[@]}" \
    --msg "Safe4337Module $*" \
    "$@"

certoraRun certora/conf/ExecTransactionFromModule.conf \
    "${params[@]}" \
    --msg "Safe4337Module $*" \
    "$@"