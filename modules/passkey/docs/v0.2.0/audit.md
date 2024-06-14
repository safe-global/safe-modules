# Audit Results

## Auditor

Certora (<https://www.certora.com/>).

## Notes

The final audit was performed on commit [8a906605010520bed5b532c9d2feb04fdf237832](https://github.com/safe-global/safe-modules/tree/8a906605010520bed5b532c9d2feb04fdf237832).

There is one acknowledged finding from the audit report:

- _I-01: EVM Version Shanghai may not work on other chains due to PUSH0_
  > We explicitly set the EVM version to target by the Solidity compiler to `paris` to avoid emitting `PUSH0` opcodes and increase compatibility across L2s.

The vendored FreshCryptoLib library implementing the secp256r1 Solidity based verification was not included in this audit. However, the contracts are used in other [audited](https://github.com/base-org/webauthn-sol/tree/619f20ab0f074fef41066ee4ab24849a913263b2/audits) smart wallets such as the Coinbase Smart Wallet's [`webauthn-sol`](https://github.com/base-org/webauthn-sol) implementation. The [Daimo P-256 verifier](https://github.com/daimo-eth/p256-verifier) has been previously [audited](https://github.com/daimo-eth/daimo/tree/52d9756da7a54888ec62a08be39d1877e2c06298/audits) and is compatible with the Safe WebAuthn signer contracts.

**:warning: Note that the `SafeWebAuthnSharedSigner` contract has not been audited :warning:**.

### Files

- [Final audit report](audit-report-certora.pdf)
