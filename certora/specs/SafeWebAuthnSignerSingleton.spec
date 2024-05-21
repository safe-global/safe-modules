
/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Implementation of _verifySignature Function (Integrity)                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifySignatureIntegrity(env e){
    bytes32 first_message;
    bytes signature;

    bool first_message_verified = verifySignatureHarnessed(e, first_message, signature);

    bytes32 second_message;
    bool second_message_verified = verifySignatureHarnessed(e, second_message, signature);

    assert (first_message_verified == true && second_message_verified == true) => first_message == second_message;
    assert first_message == second_message => first_message_verified == second_message_verified;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ getConfiguration Function (Integrity)                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
// TODO Not Completed Yet
// rule verifyGetConfigurationIntegrity(env e){

//     uint256 x;
//     uint256 y;
//     P256.Verifiers verifiers;
//     uint256 new_x; uint256 new_y; P256.Verifiers new_verifiers;
//     bytes32 message;

//     // bytes data = assignValues(e, x, y, verifiers);
//     (new_x, new_y, new_verifiers) = temp(e, x, y, verifiers);

//     // (x, y, verifiers) = getConfiguration(e);
//     // (new_x, new_y, new_verifiers) = getConfigurationHarnessed(e, data);

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

    bool hashed_data_verified = verifySignatureHarnessed(e, keccak256(data), first_signature);

    bytes second_signature;
    bytes32 message;
    bool message_verified = verifySignatureHarnessed(e, message, second_signature);

    assert (hashed_data_verified == true && message_verified == true) => message == keccak256(data);
    assert message == keccak256(data) => hashed_data_verified == message_verified;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Once signer passed isValidSignature it will never fail on it after any call                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyIsValidSignatureWillContinueToSucceed(env e){
    bytes32 message;
    bytes signature;

    bool first_verified = verifySignatureHarnessed(e, message, signature);
    require first_verified == true;

    bool second_verified = verifySignatureHarnessed(e, message, signature);
    assert second_verified;
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Once isValidSignature failed, it will never pass before createSigner called                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule IsValidSignatureMustSucceedAfterCreation(env e){
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

