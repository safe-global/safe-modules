// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

abstract contract EntryPointValidator {
    address internal supportedEntryPoint;
    constructor(address entryPoint) {
        supportedEntryPoint = entryPoint;
    }
}
