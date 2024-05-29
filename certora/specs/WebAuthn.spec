
/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ encodeClientDataJsonIntegrity 2 different challenges results in 2 different clientDataJson (Violated)               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule encodeClientDataJsonIntegrity(){

    env e;

    bytes32 challenge1;
    string clientDataFields;
    bytes32 challenge2;

    string a1 = encodeClientDataJson(e, challenge1, clientDataFields);
    string b1 = encodeClientDataJson(e, challenge2, clientDataFields);

    assert (challenge1 != challenge2) <=> !compareStrings(e, a1, b1);
    satisfy true;
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
│ CastSignature Canonical Deterministic Decoding (Violated)                                                           |
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
│ CastSignature Length Check Validity                                                                                 |
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