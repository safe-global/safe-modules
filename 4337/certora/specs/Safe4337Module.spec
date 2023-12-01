using Account as safeContract;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;
    function _._msgSender() internal => ERC2771MessageSender() expect address;
    function _.checkSignatures(bytes32, bytes, bytes) external => checkSignaturesFunctionCalled() expect bool;

    //ISafe harnessed functions
    function safeContract.getSignatureTimestamps(bytes signature) external returns (uint96) envfree;
    function safeContract.getValidAfterTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getValidUntilTimestamp(bytes sigs) external returns (uint48) envfree;

    function safeContract.getSignatures(bytes signature) external returns (bytes) envfree;

    function safeContract.execTransactionFromModule(
        address,
        uint256,
        bytes,
        Enum.Operation
    ) external returns bool; // 

    // Optional
    function validateUserOp(Safe4337Module.UserOperation,bytes32,uint256) external returns(uint256);
    function executeUserOp(address, uint256, bytes, uint8) external;
    function executeUserOpWithErrorString(address, uint256, bytes, uint8) external;
    function Safe4337Module.getOperationHash(
        address safe,
        bytes callData,
        uint256 nonce,
        uint256 preVerificationGas,
        uint256 verificationGasLimit,
        uint256 callGasLimit,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint48 validAfter,
        uint48 validUntil
    ) external returns(bytes32) envfree => CONSTANT;
}
ghost ERC2771MessageSender() returns address;

ghost bool checkSignaturesCalled;

function checkSignaturesFunctionCalled() returns bool{
    checkSignaturesCalled = true;
    return true;
}

rule onlyEntryPointCallable(method f) filtered {
    f -> f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector ||
            f.selector == sig:executeUserOp(address,uint256,bytes,uint8).selector ||
            f.selector == sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector
} {
    env e;
    calldataarg args;
    f@withrevert(e, args);
    assert !lastReverted => (ERC2771MessageSender() == SUPPORTED_ENTRYPOINT());
}

// checkSignatures should be always called if validateUserOp succeeds
rule checkSignaturesIsCalledIfValidateUserOpSucceeds(address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) {
    env e;
    uint48 validAfter;
    uint48 validUntil;
    require validAfter == safeContract.getValidAfterTimestamp(userOp.signature);
    require validUntil == safeContract.getValidUntilTimestamp(userOp.signature);
    checkSignaturesCalled = false;

    uint256 validationData = validateUserOp@withrevert(e, userOp, dummyData, missingAccountFunds);
    assert !lastReverted => checkSignaturesCalled, "transaction executed without valid signatures";
}

rule signatureTimestampsPresentInValidationData(address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) {
    env e;

    uint48 validAfter;
    uint48 validUntil;
    require validAfter == safeContract.getValidAfterTimestamp(userOp.signature);
    require validUntil == safeContract.getValidUntilTimestamp(userOp.signature);
    mathint signatureTimestamps = (to_mathint(validAfter) * 2 ^ 48) + to_mathint(validUntil);

    uint256 validationData = validateUserOp(e, userOp, dummyData, missingAccountFunds);
    mathint SignatureTimestamps = to_mathint(signatureTimestamps);
    mathint ValidationData = to_mathint(validationData >> 160);
    assert SignatureTimestamps == ValidationData;
}

rule validationDataLastBitZeroIfCheckSignaturesSucceeds(address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) {
    env e;
    uint48 validAfter;
    uint48 validUntil;
    require validAfter == safeContract.getValidAfterTimestamp(userOp.signature);
    require validUntil == safeContract.getValidUntilTimestamp(userOp.signature);
    
    bytes signatures = safeContract.getSignatures(userOp.signature);
    bytes32 transactionHash = getOperationHash(userOp.sender,
            userOp.callData,
            userOp.nonce,
            userOp.preVerificationGas,
            userOp.verificationGasLimit,
            userOp.callGasLimit,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            validAfter,
            validUntil);

    bytes checkSignaturesBytes;
    safeContract.checkSignatures@withrevert(e, transactionHash, checkSignaturesBytes, signatures);
    bool checkSignaturesOk = !lastReverted;

    uint256 validationData = validateUserOp(e, userOp, dummyData, missingAccountFunds);
    assert (checkSignaturesOk => (validationData & 0) == 0), "validation data incorrect";
}
