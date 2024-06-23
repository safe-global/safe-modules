using WebAuthnHarness as WebAuthnHarness;

methods {
    function P256.verifySignatureAllowMalleability(P256.Verifiers a, bytes32 b, uint256 c, uint256 d, uint256 e, uint256 f) internal returns (bool) => 
        verifySignatureAllowMalleabilityGhost(a, b, c, d, e, f);

    function WebAuthn.encodeSigningMessage(bytes32 challenge, bytes calldata authenticatorData, string calldata clientDataFields) internal returns (bytes memory) =>
        GETencodeSigningMessageCVL(challenge, authenticatorData, clientDataFields);

    function WebAuthnHarness.checkInjective(bytes32 challenge, bytes32 authenticatorData, bytes32 clientDataFields, bytes32 result) internal returns (bool) =>
        checkInjectiveSummary(challenge, authenticatorData, clientDataFields, result);
    function SafeWebAuthnSignerFactory.getSigner(uint256 x, uint256 y, P256.Verifiers v) internal returns (address) => getSignerGhost(x, y, v);
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

// Summary is correct only if the unique signer rule is proved spec GetSigner
ghost getSignerGhost(uint256, uint256, P256.Verifiers) returns address {
    axiom forall uint256 x1. forall uint256 y1. forall P256.Verifiers v1.
    forall uint256 x2. forall uint256 y2. forall P256.Verifiers v2.
    (getSignerGhost(x1, y1, v1) == getSignerGhost(x2, y2, v2)) <=> (x1 == x2 && y1 == y2 && v1 == v2); 
}

definition MAGIC_VALUE() returns bytes4 = to_bytes4(0x1626ba7e);

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Implementation of isValidSignature Function (Integrity)                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifySignatureUniqueness(env e){
    bytes32 first_message;
    bytes32 second_message;
    WebAuthn.Signature sigStruct;
    bytes signature = WebAuthnHarness.encodeSignature(e, sigStruct);

    bytes4 first_message_verified = isValidSignature(e, first_message, signature);
    bytes4 second_message_verified = isValidSignature(e, second_message, signature);

    assert (first_message != second_message) => !(first_message_verified == MAGIC_VALUE() && second_message_verified == MAGIC_VALUE());
    satisfy true;
}

rule verifySignatureIntegrity(env e){
    bytes32 first_message;
    bytes32 second_message;
    WebAuthn.Signature sigStruct;
    bytes signature = WebAuthnHarness.encodeSignature(e, sigStruct);

    bytes4 first_message_verified = isValidSignature(e, first_message, signature);
    require (first_message_verified == MAGIC_VALUE());

    bytes4 second_message_verified = isValidSignature(e, second_message, signature);

    assert (second_message_verified == MAGIC_VALUE()) <=> (first_message == second_message);
    satisfy true;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Both isValidSignature behave the same way                                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyIsValidSignatureAreEqual(env e){
    bytes data;
    bytes first_signature;
    WebAuthn.Signature sigStruct;
    first_signature = WebAuthnHarness.encodeSignature(e, sigStruct);

    bytes4 magicValue_hashed = isValidSignature(e, data, first_signature);

    bytes32 message;
    bytes4 magicValue_message = isValidSignature(e, message, first_signature);

    assert (magicValue_hashed == to_bytes4(0x20c13b0b) && magicValue_message == to_bytes4(0x1626ba7e)) => message == keccak256(data);
    assert message == keccak256(data) => (magicValue_hashed == to_bytes4(0x20c13b0b) && magicValue_message == to_bytes4(0x1626ba7e)) || 
                                         (magicValue_hashed == to_bytes4(0) && magicValue_message == to_bytes4(0));
    satisfy (magicValue_hashed == to_bytes4(0x20c13b0b) && magicValue_message == to_bytes4(0x1626ba7e));
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Once signer passed isValidSignature it will never fail on it after any call                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyIsValidSignatureWillContinueToSucceed(){
    env e;
    require e.msg.value == 0;

    method f;
    calldataarg args;

    bytes32 message;
    bytes signature;

    bytes4 firstVerified = isValidSignature@withrevert(e, message, signature);
    bool firstReverted = lastReverted;

    f(e, args);

    bytes4 secondVerify = isValidSignature@withrevert(e, message, signature);
    bool secondRevert = lastReverted;

    assert firstReverted == secondRevert;
    assert (!firstReverted && !secondRevert) => (firstVerified == secondVerify);
    
    satisfy (!firstReverted && firstVerified == to_bytes4(0x1626ba7e));
    satisfy true;
}
