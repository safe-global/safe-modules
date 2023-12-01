using ISafe2 as safeContract;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;

    //ISafe harnessed functions
    function safeContract.getSignatureTimestamps(bytes signature) external returns (uint96) envfree;
    function safeContract.getValidAfterTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getValidUntilTimestamp(bytes sigs) external returns (uint48) envfree;

    function safeContract.getSignatures(bytes signature) external returns (bytes) envfree;
    function safeContract.getSignatureTimestampsFromValidationData(uint256 validationData) external returns (uint96) envfree;
    function safeContract.execTransactionFromModuleCalled() external returns(bool) envfree;

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

ghost bool execTransactionFromModuleCalled;

function ExecTxCalled() returns bool {
    execTransactionFromModuleCalled = true;
    return true;
}

definition reachableOnly(method f) returns bool =
    f.selector != sig:safeContract.setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != sig:safeContract.simulateAndRevert(address,bytes).selector;

rule execTransaction(method f) filtered {
    f -> reachableOnly(f)
} {
    calldataarg args;
    env e;
    require safeContract.execTransactionFromModuleCalled() == false; 
    f(e, args);
    assert safeContract.execTransactionFromModuleCalled() => f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector ||
            f.selector == sig:executeUserOp(address,uint256,bytes,uint8).selector ||
            f.selector == sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector;
}
