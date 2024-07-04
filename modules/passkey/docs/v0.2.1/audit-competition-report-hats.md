# **Safe Audit Competition on Hats.finance**

- Prepared by: [Hats.finance](https://Hats.finance)
- Audit Competition: [Safe](https://safe.global/)
- Lead Auditor: [0xEricTee](https://x.com/0xEricTee)
- Date: June 19, 2024 - July 03,2024

## About Hats.finance

Hats.finance builds autonomous security infrastructure for integration with
major DeFi protocols to secure users' assets.

It aims to be the decentralized choice for Web3 security, offering proactive
security mechanisms like decentralized audit competitions and bug bounties.

The protocol facilitates audit competitions to quickly secure smart contracts by
having auditors compete, thereby reducing auditing costs and accelerating
submissions.

This aligns with their mission of fostering a robust, secure, and scalable Web3
ecosystem through decentralized security solutions​.

## About Safe

The Safe Protocol is a non-custodial set of smart contracts that allows users to
create programmable multi-signature accounts that require multiple parties to
authorize transactions. This provides an added layer of security and reduces the
risk of funds being lost or stolen compared to regular EOA account.

## About Hats Audit Competition

Hats Audit Competitions offer a unique and decentralized approach to enhancing
the security of web3 projects. Leveraging the large collective expertise of
hundreds of skilled auditors, these competitions foster a proactive bug hunting
environment to fortify projects before their launch. Unlike traditional security
assessments, Hats Audit Competitions operate on a time-based and results-driven
model, that ensures that only successful auditors are rewarded for their
contributions. This pay-for-results ethos not only allocates budgets more
efficiently by paying exclusively for identified vulnerabilities but also
retains funds if no issues are discovered. With a streamlined evaluation
process, Hats prioritizes quality over quantity by rewarding the first submitter
of a vulnerability, thus eliminating duplicate efforts and attracting top talent
in web3 auditing. The process embodies Hats Finance's commitment to reducing
fees, maintaining project control, and promoting high-quality security
assessments, setting a new standard for decentralized security in the web3
space​​.

## Competition Details

- Type: A public audit competition hosted by Safe
- Duration: 14 days
- Prize Pool: $16,000
- Maximum Reward: $3,200 for a high severity submission
- Total Submissions: 27
- Valid Submissions: 3
- Total Payout: $TBA USDC distributed.
- competition link:
  [link](https://app.hats.finance/audit-competitions/safe-0x2909fdefd24a1ced675cb1444918fa766d76bdac/rewards)

## Severity levels

**High:**

Issues that lead to the loss of user funds. Such issues include:

- Direct theft of any user funds, whether at rest or in motion.
- Long-term freezing of user funds.
- Theft or long term freezing of unclaimed yield or other assets.
- Protocol insolvency
- Being able to craft a valid signature without knowing the corresponding
  private key
- Being able to replay signatures in different contexts (a signature that was
  used for message A being reused for message B, where A ≠ B)
- Preventing a valid signature from being used

**Medium:**

Issues that lead to an economic loss but do not lead to direct loss of on-chain
assets. Examples are:

- Gas griefing attacks (make users overpay for gas)
- Attacks that make essential functionality of the contracts temporarily
  unusable or inaccessible.
- Short-term freezing of user funds.

**Low:**

Issues where the behavior of the contracts differs from the intended behavior
(as described in the docs and by common sense), but no funds are at risk.

## Overview

| Project Name |                                       Safe Protocol                                        |
| :----------: | :----------------------------------------------------------------------------------------: |
|  Repository  |                [safe-modules](https://github.com/safe-global/safe-modules)                 |
| Commit Hash  | [2909fde](https://github.com/hats-finance/Safe-0x2909fdefd24a1ced675cb1444918fa766d76bdac) |
|     Docs     |                     [Link](https://docs.safe.global/home/what-is-safe)                     |
|   Methods    |                                       Manual Review                                        |

### Scope

```
modules/passkey/contracts/
├── 4337
│   ├── README.md
│   └── SafeWebAuthnSharedSigner.sol
├── base
│   └── SignatureValidator.sol
├── interfaces
│   ├── IP256Verifier.sol
│   ├── ISafeSignerFactory.sol
│   └── ISafe.sol
├── libraries
│   ├── ERC1271.sol
│   ├── P256.sol
│   └── WebAuthn.sol
├── SafeWebAuthnSignerFactory.sol
├── SafeWebAuthnSignerProxy.sol
├── SafeWebAuthnSignerSingleton.sol
└── verifiers
    └── FCLP256Verifier.sol
```

### Compatibilities

- Chain(s) to deploy contract to: The exact chain list is not specified, but it
  is targetting EVM chains. It should work with chains that are supported by the
  Safe smart accounts (see chain list from: <https://app.safe.global/>) with the
  possible exception of zkSync.

### Known Issues

None

### Issues found

| Severity | Count |
| :------: | :---: |
|   High   |   0   |
|  Medium  |   0   |
|   Low    |   3   |

## Low severity issues

### [L-01] **Does not emit event after writing into storage**

**Link**:
[Issue #3](https://github.com/hats-finance/Safe-0x2909fdefd24a1ced675cb1444918fa766d76bdac/issues/3)

**Auditor:** Unknown

`SafeWebAuthnSharedSigner::configue` sets the signer configuration for the
calling account but the issue it doesn't emit event after writing into storage.

```solidity
function configure(Signer memory signer) external onlyDelegateCall {
  uint256 signerSlot = SIGNER_SLOT;
  Signer storage signerStorage;

  // solhint-disable-next-line no-inline-assembly
  assembly ('memory-safe') {
    signerStorage.slot := signerSlot
  }

  signerStorage.x = signer.x;
  signerStorage.y = signer.y;
  signerStorage.verifiers = signer.verifiers;
}
```

emit the event after writing into storage.

### [L-02] **low level staticcall return value is not checked**

**Link**:
[Issue #14](https://github.com/hats-finance/Safe-0x2909fdefd24a1ced675cb1444918fa766d76bdac/issues/14)

**Auditor:** [0xRizwann](https://x.com/0xRizwann)

```solidity
    function _sha256(bytes memory input) private view returns (bytes32 digest) {

          . . . .some code

@>            pop(staticcall(gas(), 0x0002, add(input, 0x20), mload(input), 0, 32))
            digest := mload(0)
        }
    }
```

`_sha256()` is used to compute the SHA-256 hash of the input bytes. The return
value of a low level staticcall is not checked which can be seen in above
function. Execution will resume even if the function throws an exception. If the
call fails accidentally, this may cause unexpected behaviour in the subsequent
program logic.

Low level calls like delegatecall, staticcall and call return values are always
checked so that it would revert and function should not assume, it behaved
correctly. A revert in case of function failure should be required in this case.

### [L-03] **Usage of floating pragma**

**Link**:
[Issue #17](https://github.com/hats-finance/Safe-0x2909fdefd24a1ced675cb1444918fa766d76bdac/issues/17)

**Auditor:** [0xAuditism](https://x.com/0xAuditism)

All contracts in scope have flaoting pragma.\
Pragma directives should be fixed to clearly identify the Solidity version with
which the contracts will be compiled.\
Note that libraries can still be used with floating pragmas.

```
@> pragma solidity >=0.8.0;

import {SignatureValidator} from "../base/SignatureValidator.sol";
import {ISafe} from "../interfaces/ISafe.sol";
import {P256, WebAuthn} from "../libraries/WebAuthn.sol";

/**
 * @title Safe WebAuthn Shared Signer
 * @dev A contract for verifying WebAuthn signatures shared by all Safe accounts. This contract uses
 * storage from the Safe account itself for full ERC-4337 compatibility.
 */
contract SafeWebAuthnSharedSigner is SignatureValidator {
```

## Conclusion

The audit competition for the Safe protocol on the hats.finance platform
revealed 3 low severity issues. The audit involved a comprehensive examination
of numerous aspects of Safe's code. Various issues identified included lack of
event emissions, return values from low level calls not checked and usage of
floating pragma. Each identified issue was accompanied by a proposed solution
for resolving the problem.

## Disclaimer

This report does not assert that the audited contracts are completely secure.
Continuous review and comprehensive testing are advised before deploying
critical smart contracts. The Safe audit competition illustrates the
collaborative effort in identifying and rectifying potential vulnerabilities,
enhancing the overall security and functionality of the platform. Hats.finance
does not provide any guarantee or warranty regarding the security of this
project. Smart contract software should be used at the sole risk and
responsibility of users.
