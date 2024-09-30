using Account as safeContract;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;
    function HandlerContext._msgSender() internal returns(address) => ERC2771MessageSender();
    function _.checkSignatures(bytes32, bytes, bytes) external => checkSignaturesFunctionCalled() expect bool;

    //ISafe harnessed functions
    function safeContract.getValidAfterTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getValidUntilTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getSignatures(bytes signature) external returns (bytes) envfree;
    
    // Use a DISPATCHER(true) here to only consider known contracts
    function _.execTransactionFromModule(
        address,
        uint256,
        bytes,
        Enum.Operation
    ) external => DISPATCHER(true); 

    // Optional
    function validateUserOp(Safe4337Module.PackedUserOperation,bytes32,uint256) external returns(uint256);
    function executeUserOp(address, uint256, bytes, uint8) external;
    function executeUserOpWithErrorString(address, uint256, bytes, uint8) external;
    function getOperationHash(
        Safe4337Module.PackedUserOperation userOp
    ) external returns(bytes32) envfree => PER_CALLEE_CONSTANT;
    function _checkSignaturesLength(bytes calldata, uint256) internal returns(bool) => ALWAYS(true);
}
persistent ghost ERC2771MessageSender() returns address;

persistent ghost bool checkSignaturesCalled;

function checkSignaturesFunctionCalled() returns bool {
    checkSignaturesCalled = true;
    return true;
}

rule onlyEntryPointCallable(method f) filtered {
    f -> f.selector == sig:validateUserOp(Safe4337Module.PackedUserOperation,bytes32,uint256).selector ||
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
        Safe4337Module.PackedUserOperation userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds) {
    env e;
    checkSignaturesCalled = false;

    uint256 validationData = validateUserOp@withrevert(e, userOp, userOpHash, missingAccountFunds);
    assert !lastReverted => checkSignaturesCalled, "validation passed without checking signatures";
}

rule signatureTimestampsPresentInValidationData(address sender,
        Safe4337Module.PackedUserOperation userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds) {
    env e;
    uint48 validAfter;
    uint48 validUntil;
    require validAfter == safeContract.getValidAfterTimestamp(userOp.signature);
    require validUntil == safeContract.getValidUntilTimestamp(userOp.signature);
    mathint signatureTimestamps = (to_mathint(validAfter) * 2 ^ 48) + to_mathint(validUntil);

    uint256 validationData = validateUserOp(e, userOp, userOpHash, missingAccountFunds);
    mathint SignatureTimestamps = to_mathint(signatureTimestamps);
    mathint ValidationData = to_mathint(validationData >> 160);
    assert SignatureTimestamps == ValidationData;
}

rule validationDataLastBitZeroIfCheckSignaturesSucceeds(address sender,
        Safe4337Module.PackedUserOperation userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds) {
    env e;

    bytes signatures = safeContract.getSignatures(userOp.signature);
    bytes32 safeOpHash = getOperationHash(userOp);

    bytes checkSignaturesBytes;
    safeContract.checkSignatures@withrevert(e, safeOpHash, checkSignaturesBytes, signatures);
    bool checkSignaturesOk = !lastReverted;

    uint256 validationData = validateUserOp(e, userOp, userOpHash, missingAccountFunds);
    assert (checkSignaturesOk => (validationData & 1) == 0), "validation data incorrect";
}

rule balanceChangeAfterValidateUserOp(
        Safe4337Module.PackedUserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds)  {

    calldataarg args;
    env e;

    uint256 balanceBefore = nativeBalances[safeContract];
    require balanceBefore >= missingAccountFunds;
    
    validateUserOp(e, userOp, dummyData, missingAccountFunds);

    uint256 balanceAfter = nativeBalances[safeContract];
    assert balanceAfter >= assert_uint256(balanceBefore - missingAccountFunds);
}
