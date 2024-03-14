# Passkey

This package contains a passkey signature verifier, that can be used as an owner for a Safe, compatible with versions 1.3.0+.

## Setup and Execution flow

```mermaid
sequenceDiagram
actor U as User
participant CS as CredentialStore
actor B as Bundler
participant EP as EntryPoint
participant SPF as SafeProxyFactory
participant WASF as WebAuthnSignerFactory
participant SP as SafeProxy
participant SSL as SafeSignerLaunchpad
participant S as Singleton
participant M as Module
participant WAV as WebAuthnVerifier
participant PV as P256Verifier
actor T as Target

U->>+CS: Create Credential (User calls `create(...)`)
CS->>U: Decode public key from the return value
U->>+WASF: Get signer address (signer might not be deployed yet)
WASF->>U: Signer address
U->>+B: Submit UserOp payload that deploys SafeProxy address with SafeSignerLaunchpad as singleton in initCode and corresponding call data that calls `initializeThenUserOp(...)` ands sets implementation to Safe Singleton

B->>+EP: Submit User Operations
EP->>+SP: Validate UserOp
SP-->>SSL: Load SignerLaunchpad logic
SSL-->>WASF: Forward validation
WASF-->>WAV: call verifyWebAuthnSignatureAllowMalleability
WAV->>+PV: Verify signature
PV->>WAV: Signature verification result
WAV->>WASF: Signature verification result
WASF-->>SSL: Return magic value
    opt Pay required fee
        SP->>EP: Perform fee payment
    end
SP-->>-EP: Validation response

EP->>+SP: Execute User Operation with call to `initializeThenUserOp(...)`
SP-->>SSL: Load SignerLaunchpad logic
SP->>+WASF: Create Signer
WASF-->>SP: Return owner address
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

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

All smart contracts are released under LGPL-3.0.