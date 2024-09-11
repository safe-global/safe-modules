# Changelog

This changelog only contains changes starting from version 0.1.1

# Version 0.1.1

## Compiler settings

Solidity compiler: [0.7.6](https://github.com/ethereum/solidity/releases/tag/v0.7.6)

Solidity optimizer: disabled

## Expected addresses

- `AllowanceModule` at `0xAA46724893dedD72658219405185Fb0Fc91e091C`

## Changes

### General

#### Fix the EIP-712 transfer typehash

Issue: [#70](https://github.com/safe-global/safe-modules/issues/70)

The typehash for the transfer was incorrect, making it impossible to use the module with EIP-712 signatures.

#### Add a check for `resetTimeMin` 

For recurring allowances, the `resetTimeMin` must be greater than 0. However, the check was missing, making it possible to specify a `resetTimeMin` of 0, resulting in a divide by zero error and the transaction consuming all gas.

The change was suggested by the [Ackee blockchain](https://ackee.xyz/) during the audit of the module.