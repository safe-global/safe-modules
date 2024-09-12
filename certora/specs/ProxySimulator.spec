using SafeWebAuthnSignerProxy as SafeWebAuthnSignerProxy;
using WebAuthnHarnessWithMunge as WebAuthnHarness;

methods {
    function P256.verifySignatureAllowMalleability(P256.Verifiers a, bytes32 b, uint256 c, uint256 d, uint256 e, uint256 f) internal returns (bool) => 
        verifySignatureAllowMalleabilityGhost(a, b, c, d, e, f);

    function WebAuthn.encodeSigningMessage(bytes32 challenge, bytes calldata authenticatorData, string calldata clientDataFields) internal returns (bytes memory) =>
        GETencodeSigningMessageCVL(challenge, authenticatorData, clientDataFields);

    function WebAuthnHarness.checkInjective(bytes32 challenge, bytes32 authenticatorData, bytes32 clientDataFields, bytes32 result) internal returns (bool) =>
        checkInjectiveSummary(challenge, authenticatorData, clientDataFields, result);

    function _._ external => DISPATCH [
        SafeWebAuthnSignerProxy._,
        SafeWebAuthnSignerSingleton._
    ] default NONDET;
}

function GETencodeSigningMessageCVL(bytes32 challenge, bytes authenticatorData, string clientDataFields) returns bytes
{
    env e;
    return WebAuthnHarness.GETencodeSigningMessageSummary(e, challenge, authenticatorData, clientDataFields);
}

ghost checkInjectiveSummary(bytes32, bytes32, bytes32, bytes32) returns bool {
    axiom forall bytes32 x1. forall bytes32 y1. forall bytes32 z1. forall bytes32 x2. forall bytes32 y2. forall bytes32 z2. forall bytes32 result.
    checkInjectiveSummary(x1, y1, z1, result) && checkInjectiveSummary(x2, y2, z2, result) => x1 == x2;
}

ghost verifySignatureAllowMalleabilityGhost(P256.Verifiers, bytes32, uint256, uint256, uint256, uint256) returns bool {
    axiom forall P256.Verifiers a. forall bytes32 message1. forall bytes32 message2. forall uint256 c. forall uint256 d. forall uint256 e. forall uint256 f.
        verifySignatureAllowMalleabilityGhost(a, message1, c, d, e, f) && 
        verifySignatureAllowMalleabilityGhost(a, message2, c, d, e, f) => message1 == message2;
}

// This is the same MAGIC_VALUE constant used in ERC1271.
definition MAGIC_VALUE() returns bytes4 = to_bytes4(0x1626ba7e);

/*
Property 14. Proxy - verify return data from the fallback is only one of the magicNumbers
Uses another contract that simulates interaction with the proxy. The reason is that the prover doesn't check all
possible calldata values so this simulation will make the prover choose different values that will be passed on the calldata.
Rule stuck.
*/
rule proxyReturnValue {
    env e;
    bytes32 message;
    bytes signature;

    bytes4 ret = authenticate(e, message, signature);

    satisfy ret == MAGIC_VALUE() || ret == to_bytes4(0);
}
