#!/bin/bash

params=()

if [[ -n "$CI" ]]; then
    params=("--wait_for_results")
fi

certoraRun certora/conf/Safe4337Module.conf \
"${params[@]}" \
"$@"

# certoraRun certora/conf/PayForMissingFunds.conf \
#     "${params[@]}" \
#     --msg "Safe4337Module $*" \
#     "$@"

# certoraRun certora/conf/ExecTransactionFromModule.conf \
#     "${params[@]}" \
#     --msg "Safe4337Module $*" \
#     "$@"

# certoraRun certora/conf/ValidationDataLastBitOne.conf \
#     "${params[@]}" \
#     --msg "Safe4337Module $*" \
#     "$@"
