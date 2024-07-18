#!/bin/bash

params=()

if [[ -n "$CI" ]]; then
    params=("--wait_for_results")
fi

certoraRun certora/conf/SignatureLengthCheck.conf \
    "${params[@]}" \
    "$@"

