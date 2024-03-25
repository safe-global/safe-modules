# Changelog

This changelog only contains changes starting from version 0.2.0

# Version 0.3.0

## Compiler settings

Solidity compiler: [0.8.23](https://github.com/ethereum/solidity/releases/tag/v0.8.23)

Solidity optimizer: enabled with 10.000.000 runs

## Supported EntryPoint

The official deployments support the EntryPoint v0.7.0 with the canonical deployment at `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.

## Expected addresses

- `SafeModuleSetup` at `0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47`
- `Safe4337Module` at `0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226`

## Changes

### Security Fixes

None

### Compatibility Fixes

None

### General

- Use the new `PackedUserOperation` struct from EntryPoint v0.7.0 ([#225](https://github.com/safe-global/safe-modules/issues/225))
- The `AddModulesLib` implementation was optimized, got missing NatSpecs and was renamed to `SafeModuleSetup` ([#241](https://github.com/safe-global/safe-modules/pull/241]))
- Use hardcoded constants for type hashes and domain separators in `Safe4337Module` ([#179](https://github.com/safe-global/safe-modules/issues/179]))
- Pinned Solidity version to 0.8.23 ([#239](https://github.com/safe-global/safe-modules/pull/239))
- Fixed misleading comments in the contract ([#240](https://github.com/safe-global/safe-modules/pull/240))
- Added a security contact to the `Safe4337Module` ([#244](https://github.com/safe-global/safe-modules/pull/244))
- Improved consistency of named returns in the `Safe4337Module` ([#242](https://github.com/safe-global/safe-modules/pull/242))

# Version 0.2.0

## Compiler settings

Solidity compiler: [0.8.23](https://github.com/ethereum/solidity/releases/tag/v0.8.23)

Solidity optimizer: enabled with 10.000.000 runs

## Supported EntryPoint

The official deployments support the EntryPoint v0.6.0 with the canonical deployment at `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`.

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
