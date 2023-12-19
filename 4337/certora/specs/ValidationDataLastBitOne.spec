using AlwaysRevertingAccount as safeContract;

methods {
    // Use dispatcher(true) here to only consider known contracts
    function _.checkSignatures(bytes32, bytes, bytes) external => DISPATCHER(true);

    //ISafe harnessed functions
    function safeContract.getValidAfterTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getValidUntilTimestamp(bytes sigs) external returns (uint48) envfree;

    function safeContract.getSignatures(bytes signature) external returns (bytes) envfree;

    // Optional
    function validateUserOp(Safe4337Module.UserOperation,bytes32,uint256) external returns(uint256);
    function getOperationHash(
        Safe4337Module.UserOperation userOp
    ) external returns(bytes32) envfree => PER_CALLEE_CONSTANT;
}

rule validationDataLastBitOneIfCheckSignaturesFails(address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) {
    env e;
    uint48 validAfter;
    uint48 validUntil;
    require validAfter == safeContract.getValidAfterTimestamp(userOp.signature);
    require validUntil == safeContract.getValidUntilTimestamp(userOp.signature);
    require userOp.sender == safeContract;

    bytes signatures = safeContract.getSignatures(userOp.signature);
    bytes32 safeOpHash = getOperationHash(userOp);

    bytes checkSignaturesBytes;
    safeContract.checkSignatures@withrevert(e, safeOpHash, checkSignaturesBytes, signatures);
    bool checkSignaturesReverted = lastReverted;

    uint256 validationData = validateUserOp(e, userOp, dummyData, missingAccountFunds);
    assert checkSignaturesReverted => (validationData & 1) == 1, "validation data incorrect";
}

