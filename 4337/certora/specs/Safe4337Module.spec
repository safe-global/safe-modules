using ISafe as safeContract;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;
    function _._msgSender() internal => ERC2771MessageSender() expect address;
    function _.checkSignatures(bytes32, bytes, bytes) external => DISPATCHER(true);

    //ISafe harnessed functions
    function safeContract.getSignatureTimestamps(bytes signature) external returns (uint96) envfree;
    function safeContract.getSignatures(bytes signature) external returns (bytes) envfree;

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
        uint96 signatureTimestamps,
        address entryPoint
    ) external returns(bytes32) envfree => CONSTANT;
}

ghost ERC2771MessageSender() returns address;

rule onlyEntryPointCallable(method f) filtered {
    f -> f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector ||
            f.selector == sig:executeUserOp(address,uint256,bytes,uint8).selector ||
            f.selector == sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector
} {
    env e;
    calldataarg args;
    f(e, args);
    assert ERC2771MessageSender() == SUPPORTED_ENTRYPOINT();
}

// checkSignatures should be always called if validateUserOp succeeds
rule checkSignaturesIsCalledIfValidateUserOpSucceeds(address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) {
    env e;
    uint96 x;
    require x == safeContract.getSignatureTimestamps(userOp.signature);
    bytes signatures = safeContract.getSignatures(userOp.signature);
    bytes32 transactionHash = getOperationHash(userOp.sender,
            userOp.callData,
            userOp.nonce,
            userOp.preVerificationGas,
            userOp.verificationGasLimit,
            userOp.callGasLimit,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            x,
            SUPPORTED_ENTRYPOINT());

    bytes checkSignaturesBytes;
    safeContract.checkSignatures@withrevert(e, transactionHash, checkSignaturesBytes, signatures);
    bool checkSignaturesOk = !lastReverted;

    validateUserOp(e, userOp, dummyData, missingAccountFunds);
    assert checkSignaturesOk, "transaction executed without valid signatures";
}