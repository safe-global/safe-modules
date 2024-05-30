using SafeWebAuthnSignerProxy as proxy;
using WebAuthnHarness as WebAuthnHarness;

methods {
    function P256.verifySignatureAllowMalleability(P256.Verifiers a, bytes32 b, uint256 c, uint256 d, uint256 e, uint256 f) internal returns (bool) => 
        verifySignatureAllowMalleabilityGhost(a, b, c, d, e, f);

    function WebAuthn.encodeSigningMessage(bytes32 challenge, bytes calldata authenticatorData, string calldata clientDataFields) internal returns (bytes memory) =>
        GETencodeSigningMessageCVL(challenge, authenticatorData, clientDataFields);

    function WebAuthnHarness.checkInjective(bytes32 challenge, bytes32 authenticatorData, bytes32 clientDataFields, bytes32 result) internal returns (bool) =>
        checkInjectiveSummary(challenge, authenticatorData, clientDataFields, result);
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

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Implementation of _verifySignature Function (Integrity)                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifySignatureUniqueness(env e){
    bytes32 first_message;
    bytes32 second_message;
    bytes signature;

    require (first_message != second_message);

    bool first_message_verified = verifySignatureHarnessed(e, first_message, signature);
    bool second_message_verified = verifySignatureHarnessed(e, second_message, signature);

    assert !(first_message_verified && second_message_verified);
}

rule verifySignatureIntegrity(env e){
    bytes32 first_message;
    bytes32 second_message;
    bytes signature;

    bool first_message_verified = verifySignatureHarnessed(e, first_message, signature);
    require (first_message_verified);

    bool second_message_verified = verifySignatureHarnessed(e, second_message, signature);

    assert second_message_verified <=> first_message == second_message;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ getConfiguration Function (Integrity)                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

// TODO Not Completed Yet
// rule verifyGetConfigurationIntegrity(env e){
//     bytes32 data;
//     bytes first_signature;

//     uint256 x;
//     uint256 y;
//     P256.Verifiers verifiers;
//     uint256 new_x; uint256 new_y; P256.Verifiers new_verifiers;

//     x = proxy.getX();
//     y = proxy.getY();
//     verifiers = proxy.getVerifiers();
//     (new_x, new_y, new_verifiers) = proxy.getConfiguration(e);

//     assert x == new_x;
//     assert y == new_y;
//     assert verifiers == new_verifiers;
//     satisfy true;
// }

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Both is valid Signature behave the same way                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyIsValidSignatureAreEqual(env e){
    bytes data;
    bytes first_signature;

    bytes4 magicValue_hashed = isValidSignature(e, data, first_signature);

    bytes32 message;
    bytes4 magicValue_message = isValidSignature(e, message, first_signature);

    assert (magicValue_hashed == to_bytes4(0x20c13b0b) && magicValue_message == to_bytes4(0x1626ba7e)) => message == keccak256(data);
    assert message == keccak256(data) => (magicValue_hashed == to_bytes4(0x20c13b0b) && magicValue_message == to_bytes4(0x1626ba7e)) || 
                                         (magicValue_hashed != to_bytes4(0x20c13b0b) && magicValue_message != to_bytes4(0x1626ba7e));
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Once signer passed isValidSignature it will never fail on it after any call                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyIsValidSignatureWillContinueToSucceed(env e){
    method f;
    calldataarg args;
    bytes32 message;
    bytes signature;

    bool first_verified = verifySignatureHarnessed(e, message, signature);
    require first_verified == true;

    f(e, args);

    bool second_verified = verifySignatureHarnessed(e, message, signature);
    assert second_verified;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Once isValidSignature failed, it will never pass before createSigner called                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule IsValidSignatureWillSucceedOnlyAfterCreation(env e){
    method f;
    calldataarg args;

    bytes32 message;
    bytes signature;

    bool first_verified = verifySignatureHarnessed(e, message, signature);
    require !first_verified;

    f(e, args);

    bool second_verified = verifySignatureHarnessed(e, message, signature);
    assert second_verified => f.selector == sig:SafeWebAuthnSignerFactory.createSigner(uint256, uint256, P256.Verifiers).selector;
}
