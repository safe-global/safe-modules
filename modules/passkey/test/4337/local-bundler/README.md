# ERC-4337 Local Bundler Tests

ERC-4337 imposes additional restrictions on account creation and signature validation (such as limiting the on-chain storage that can be accessed). This subdirectory contains tests that run against the local ERC-4337 reference bundler in order to verify that the passkey implementation is fully compatible with the standard.

## Usage

```sh
pnpm run test:4337
```
