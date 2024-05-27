methods{
    function getEncodeClientDataJsonSummary(bytes32 message, string calldata signature) external returns (string memory);
    
    function encodeClientDataJson(bytes32 message, string calldata signature) internal returns (string memory) => 
        getEncodeClientDataJsonSummaryCVL(message, signature);
    
    function encodeAxiom(bytes32 message, bytes32 signature, bytes32 result) internal returns (bool) =>
        encodeAxiomSummary(message, signature, result);

    //function encodeSigningMessage(bytes32,bytes calldata,string calldata) internal returns(bytes memory) => NONDET;
    function castSignature(bytes calldata signature) external returns (bool, WebAuthn.Signature calldata);
}

function getEncodeClientDataJsonSummaryCVL(bytes32 message, string signature) returns string
{
    env e;
    return getEncodeClientDataJsonSummary(e, message, signature);
}

ghost encodeAxiomSummary(bytes32, bytes32, bytes32) returns bool {
    axiom forall bytes32 x1. forall bytes32 y1. forall bytes32 x2. forall bytes32 y2. forall bytes32 z.
    (x1 != x2 || y1 != y2) => !(encodeAxiomSummary(x1, y1, z) && encodeAxiomSummary(x2, y2, z));
}

// Inner Check for Summarization
rule encodeClientDataJsonIntegrity(){

    env e;

    bytes32 challenge1;
    string clientDataFields;
    bytes32 challenge2;

    string a1 = encodeClientDataJson(e, challenge1, clientDataFields);
    string b1 = encodeClientDataJson(e, challenge2, clientDataFields);

    assert (challenge1 != challenge2) <=> !compareStrings(e, a1, b1);
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
    string clientDataField;

    bytes message1 = encodeSigningMessage(e, challenge1, authenticatorData, clientDataField);
    bytes message2 = encodeSigningMessage(e, challenge2, authenticatorData, clientDataField);

    assert (challenge1 != challenge2) <=> (getSha256(e, message1) != getSha256(e, message2));
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ verifySignature functions are equivalent (Vacuity check timeout cert-6290)                                          │
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

    bool result2 = verifySignature@withrevert(e, challenge, bytesSignature, authenticatorFlags, x, y, verifiers) at firstStorage;
    bool secondCallRevert = lastReverted;

    assert (firstCallRevert == secondCallRevert) || (result1 == result2);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CastSignature Consistent (Once valid always valid, Once failed always failed, includes revert cases and middle call)|
│   (Proved)                                                                                                          |
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule castSignatureConsistent(){
    env e;
    method f;
    calldataarg args;

    bytes signature;
    
    bool firstIsValid;
    WebAuthn.Signature firstData;
    
    bool secondIsValid;
    WebAuthn.Signature secondData;

    firstIsValid, firstData = castSignature@withrevert(e, signature);
    bool firstRevert = lastReverted;

    f(e, args);

    secondIsValid, secondData = castSignature@withrevert(e, signature);
    bool secondRevert = lastReverted;

    if (!firstRevert && !secondRevert) {
        assert compareSignatures(e, firstData, secondData) && firstIsValid == secondIsValid;
    }

    assert firstRevert == secondRevert;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ CastSignature uniqueness (violated)                                                                                 |
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule castSignatureUniqueness(){
    
    env e;

    bytes signature1;
    bytes signature2;
    
    bool firstIsValid;
    WebAuthn.Signature firstData;
    
    bool secondIsValid;
    WebAuthn.Signature secondData;

    firstIsValid, firstData = castSignature(e, signature1);

    secondIsValid, secondData = castSignature(e, signature2);

    assert ((getSha256(e, signature1) != getSha256(e, signature2)) &&
    ((firstIsValid && secondIsValid))) => !compareSignatures(e, firstData, secondData);
}