# Passkey

This package contains a passkey signature verifier, that can be used as an owner for a Safe, compatible with versions 1.3.0+.

## Execution flow

```mermaid
sequenceDiagram
actor U as User
participant CS as CredentialStore
participant SPF as SafeProxyFactory
participant WASF as WebAuthnSignerFactory
participant SSL as SafeSignerLaunchpad
participant SS as SafeSingleton
participant SP as SafeProxy
participant WAV as WebAuthnVerifier
participant PV as P256Verifier
actor T as Target

U->>+CS: Create Credential (User calls `create(...)`)
CS->>U: Decode public key from the return value
U->>+WASF: Get signer address (signer might not be deployed yet) 
WASF->>U: Signer address
U->>+SPF: Submit Payload that calculates SafeProxy address with SafeSignerLaunchpad as singleton and corresponding initializer data
U->>+Bundler: Submit Payload that contains init code to deploy SafeProxy and callData containing initializer data and UserOp
Bundler->>SPF: Deploy SafeProxy

```