# Changelog

# Version 0.2.1

## Compiler settings

Solidity compiler: [0.8.26](https://github.com/ethereum/solidity/releases/tag/v0.8.26)

Solidity optimizer: enabled with 10.000.000 runs (via IR for all contracts except `FCLP256Verifier`)
EVM target: Paris

## Expected addresses

- `SafeWebAuthnSignerFactory` at `TBD`
- `SafeWebAuthnSharedSigner` at `TBD`
- `DaimoP256Verifier` at `0xc2b78104907F722DABAc4C69f826a522B2754De4`
- `FCLP256Verifier` at `TBD`

## Changes

### Security Fixes

- Check the success of the static call to the SHA-256 precompile.

### General

- Use compiler version 0.8.26 and use IR optimizer for all contracts (except `FCLP256Verifier` as it introduces perfomance regressions). This simultaneously decreases code size and runtime gas costs.
- Index the `signer` field for `Created` event in the `SafeWebAuthnSignerFactory` contract.
- Use more consistent compiler version pragmas throughout the contracts.
- Initial release of the `SafeWebAuthnSharedSigner` contract.

# Version 0.2.0

## Compiler settings

Solidity compiler: [0.8.24](https://github.com/ethereum/solidity/releases/tag/v0.8.24)

Solidity optimizer: enabled with 10.000.000 runs
EVM target: Paris

## Expected addresses

- `SafeWebAuthnSignerFactory` at `0xF7488fFbe67327ac9f37D5F722d83Fc900852Fbf`
- `DaimoP256Verifier` at `0xc2b78104907F722DABAc4C69f826a522B2754De4`
- `FCLP256Verifier` at `0x445a0683e494ea0c5AF3E83c5159fBE47Cf9e765`

## Changes

### General

- First release of the passkey contracts.
