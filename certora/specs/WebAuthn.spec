
methods {
    function WebAuthn.encodeClientDataJson(bytes32 challenge, string calldata clientDataFields) internal returns (string memory) =>
        SencodeDataJsonCVL(challenge, clientDataFields);

    function checkInjective(bytes32 challenge, bytes32 clientDataFields, bytes32 result) internal returns (bool) =>
        checkInjectiveSummary(challenge, clientDataFields, result);

    function P256.verifySignatureAllowMalleability(P256.Verifiers a, bytes32 b, uint256 c, uint256 d, uint256 e, uint256 f) internal returns bool => 
        verifySignatureAllowMalleabilityGhost(a, b, c, d, e, f);
}

function SencodeDataJsonCVL(bytes32 challenge, string clientDataFields) returns string
{
    env e;
    return summaryEncodeDataJson(e, challenge, clientDataFields);
}

ghost checkInjectiveSummary(bytes32, bytes32, bytes32) returns bool {
    axiom forall bytes32 x1. forall bytes32 y1. forall bytes32 x2. forall bytes32 y2. forall bytes32 result.
    (x1 != x2) => !(checkInjectiveSummary(x1, y1, result) && checkInjectiveSummary(x2, y2, result));
}

ghost verifySignatureAllowMalleabilityGhost(P256.Verifiers, bytes32, uint256, uint256, uint256, uint256) returns bool {
    axiom forall P256.Verifiers a. forall bytes32 message1. forall bytes32 message2. forall uint256 c. forall uint256 d. forall uint256 e. forall uint256 f.
        verifySignatureAllowMalleabilityGhost(a, message1, c, d, e, f) && 
        verifySignatureAllowMalleabilityGhost(a, message2, c, d, e, f) => message1 == message2;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ shaIntegrity 2 different inputs results in 2 different hashes (Proved)                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule shaIntegrity(){
    env e;
    
    bytes input1;
    bytes input2;
    
    bytes32 input1_sha = getSha256(e, input1);
    bytes32 input2_sha = getSha256(e, input2);
    
    assert (keccak256(input1) != keccak256(input2)) <=> input1_sha != input2_sha;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ every 2 challenges results in unique message when using encodeSigningMessage (Timeout cert-6290)                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule uniqueMessagePerChallenge(){
    env e;

    bytes32 challenge1;
    bytes32 challenge2;
    bytes authenticatorData;
    require authenticatorData.length % 32 == 0;
    string clientDataField;

    bytes message1 = encodeSigningMessage(e, challenge1, authenticatorData, clientDataField);
    bytes message2 = encodeSigningMessage(e, challenge2, authenticatorData, clientDataField);

    assert (challenge1 != challenge2) <=> (getSha256(e, message1) != getSha256(e, message2));
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ verifySignature functions are equivalent (Proved)                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule verifySignatureEq(){
    env e;

    // verify signature related args
    bytes32 challenge;
    WebAuthn.AuthenticatorFlags authenticatorFlags;
    uint256 x;
    uint256 y;
    P256.Verifiers verifiers;

    // signature related args
    bytes authenticatorData;
    string clientDataFields;
    uint256 r;
    uint256 s;
    bytes bytesSignature;
    WebAuthn.Signature structSignature;

    bytesSignature, structSignature = prepareSignature(e, authenticatorData, clientDataFields, r, s);

    storage firstStorage = lastStorage;

    bool result1 = verifySignature@withrevert(e, challenge, bytesSignature, authenticatorFlags, x, y, verifiers);
    bool firstCallRevert = lastReverted;

    bool result2 = verifySignature@withrevert(e, challenge, structSignature, authenticatorFlags, x, y, verifiers) at firstStorage;
    bool secondCallRevert = lastReverted;

    assert firstCallRevert == secondCallRevert;
    assert (!firstCallRevert && !secondCallRevert) => result1 == result2;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ verifySignature consistent (Proved)                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule verifySignatureConsistent(){
    env e;
    env e1;
    env e2;
    require e1.msg.value == 0 && e2.msg.value == 0;
    method f;
    calldataarg args;

    bytes32 challenge;
    WebAuthn.AuthenticatorFlags authenticatorFlags;
    uint256 x;
    uint256 y;
    P256.Verifiers verifiers;
    bytes bytesSignature;


    bool result1 = verifySignature@withrevert(e1, challenge, bytesSignature, authenticatorFlags, x, y, verifiers);
    bool firstCallRevert = lastReverted;

    f(e, args);

    bool result2 = verifySignature@withrevert(e2, challenge, bytesSignature, authenticatorFlags, x, y, verifiers);
    bool secondCallRevert = lastReverted;

    assert firstCallRevert == secondCallRevert;
    assert (!firstCallRevert && !secondCallRevert) => result1 == result2;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CastSignature Consistent (Once valid always valid, Once failed always failed, includes revert cases and middle call)|
│   (Proved)                                                                                                          |
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule castSignatureConsistent(){
    env e;
    env e1;
    env e2;

    require (e1.msg.value == e2.msg.value) && (e1.msg.value == e.msg.value) && (e.msg.value == 0);

    method f;
    calldataarg args;

    bytes signature;
    
    bool firstIsValid;
    WebAuthn.Signature firstData;
    
    bool secondIsValid;
    WebAuthn.Signature secondData;

    firstIsValid, firstData = castSignature@withrevert(e1, signature);
    bool firstRevert = lastReverted;

    f(e, args);

    secondIsValid, secondData = castSignature@withrevert(e2, signature);
    bool secondRevert = lastReverted;

    if (!firstRevert && !secondRevert) {
        assert compareSignatures(e, firstData, secondData) && firstIsValid == secondIsValid;
    }

    assert (firstRevert == secondRevert);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CastSignature Canonical Deterministic Decoding (Proved)                                                             |
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule castSignatureDeterministicDecoding(){
    env e;

    WebAuthn.Signature structSignature;
    bytes encodeSig = encodeSignature(e, structSignature);

    WebAuthn.Signature decodedSignature;
    bool isValid;

    isValid, decodedSignature = castSignature(e, encodeSig);

    assert isValid <=> compareSignatures(e, structSignature, decodedSignature);
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CastSignature Length Check Validity (Proved)                                                                        |
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule castSignatureLengthCheckValidity(){
    env e;

    WebAuthn.Signature structSignature;
    bytes encodeSig;

    WebAuthn.Signature decodedSignature;
    bool isValid;

    isValid, decodedSignature = castSignature(e, encodeSig);

    assert compareSignatures(e, structSignature, decodedSignature) => (
        isValid <=> encodeSig.length <= encodeSignature(e, structSignature).length
    );
}