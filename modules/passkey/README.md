# Passkey

This package contains a passkey signature verifier, that can be used as an owner for a Safe, compatible with versions 1.3.0+.

## SafeWebAuthnSignerProxy

Use of `SafeWebAuthnSignerProxy` provides gas savings compared to the complete bytecode contract for each signer creation. The `SafeWebAuthnSignerProxy` contract is a proxy contract that forwards calls to the `SafeWebAuthnSignerSingleton` contract which is a singleton contract. Both `SafeWebAuthnSignerProxy` and `SafeWebAuthnSignerSingleton` use no storage slots to avoid storage access violations defined in ERC-4337. The details on gas savings can be found in [this PR](https://github.com/safe-global/safe-modules/pull/370).

## Setup and Execution flow

```mermaid
sequenceDiagram
actor U as User
participant CS as CredentialStore
actor B as Bundler
participant EP as EntryPoint
participant SPF as SafeProxyFactory
participant SWASPF as SafeWebAuthnSignerProxyFactory
participant SP as SafeProxy
participant SSL as SafeSignerLaunchpad
participant S as Singleton
participant M as Module
participant SWASS as SafeWebAuthnSignerSingleton
participant WAV as WebAuthn library
participant PV as P256Verifier
actor T as Target

U->>+CS: Create Credential (User calls `create(...)`)
CS->>U: Decode public key from the return value
U->>+SWASPF: Get signer address (signer might not be deployed yet)
SWASPF->>U: Signer address
U->>+B: Submit UserOp payload that deploys SafeProxy address with SafeSignerLaunchpad as singleton in initCode and corresponding call data that calls `initializeThenUserOp(...)` ands sets implementation to Safe Singleton

B->>+EP: Submit User Operations
EP->>+SP: Validate UserOp
SP-->>SSL: Load SignerLaunchpad logic
SSL-->>SWASPF: Forward validation
SWASPF-->>SWASS: call isValidSignature(bytes32,bytes) with x,y values and verifier address added to the call data
SWASS-->>WAV: call verifyWebAuthnSignatureAllowMalleability
WAV->>+PV: Verify signature
PV->>WAV: Signature verification result
WAV->>SWASS: Signature verification result
SWASS->>SWASPF: Signature verification result
SWASPF-->>SSL: Return magic value
    opt Pay required fee
        SP->>EP: Perform fee payment
    end
SP-->>-EP: Validation response

EP->>+SP: Execute User Operation with call to `initializeThenUserOp(...)`
SP-->>SSL: Load SignerLaunchpad logic
SP->>+SWASPF: Create Signer
SWASPF-->>SP: Return owner address
SP->>SP: Setup Safe
SP-->>SP: delegatecall with calldata received in `initializeThenUserOp(...)`
SP-->>S: Load Safe logic
SP->>+M: Forward execution
M->>SP: Execute From Module
SP-->>S: Load Safe logic
SP->>+T: Perform transaction
    opt Bubble up return data
        T-->>-SP: Call Return Data
        SP-->>M: Call Return Data
        M-->>-SP: Call return data
        SP-->>-EP: Call return data
    end
```

ERC-4337 outlines specific storage access rules for the validation phase, which limits the deployment of SafeProxy for use with the passkey flow. To navigate this restriction, in the `initCode` of UserOp, a `SafeProxy` is deployed with `SafeSignerLaunchpad` as a singleton. The `SafeSignerLaunchpad` is used to validate the signature of the UserOp. The `SafeSignerLaunchpad` forwards the signature validation to the `SafeWebAuthnSignerSingleton`, which in turn forwards the signature validation to the `WebAuthn` library. `WebAuthn` forwards the call to `P256Verifier`. The `P256Verifier` is used to validate the signature. In the validation, phase the launchpad stores the Safe's setup hash (owners, threshold, modules, etc) which is then verified during the execution phase.

During the execution phase, the implementation of the `SafeProxy` is set to the Safe Singleton along with the owner as signer contract deployed by SafeSignerLaunchpad.

## Usage

### Install Requirements With NPM:

```bash
npm install
```

### Run Hardhat Tests:

```bash
npm test
npm run test:4337
```

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

All smart contracts are released under LGPL-3.0.
