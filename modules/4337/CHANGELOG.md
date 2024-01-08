# Changelog

This changelog only contains changes starting from version 0.2.0

# Version 0.2.0

## Compiler settings

Solidity compiler: [0.8.23](https://github.com/ethereum/solidity/releases/tag/v0.8.23)

Solidity optimizer: enabled with 10.000.000 runs

## Expected addresses

- `AddModulesLib` at `0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb`
- `Safe4337Module` at `0xa581c4A4DB7175302464fF3C06380BC3270b4037`

## Changes

### Security Fixes

- Sign Full User Operation Data ([#177](https://github.com/safe-global/safe-modules/pull/177))

### Compatibility Fixes

- Send encoded Safe operation bytes to `checkSignatures` call ([#165](https://github.com/safe-global/safe-modules/pull/165))
- Fix Revert message propagation ([#163](https://github.com/safe-global/safe-modules/pull/163))

### General

- Support `validAfter` and `validUntil` timestamps ([#156](https://github.com/safe-global/safe-modules/pull/156))
