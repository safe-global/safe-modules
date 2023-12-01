using ISafe3 as safeContract;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;

    //ISafe harnessed functions
    function safeContract.getSignatureTimestamps(bytes signature) external returns (uint96) envfree;
    function safeContract.getValidAfterTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.getValidUntilTimestamp(bytes sigs) external returns (uint48) envfree;
    function safeContract.isModuleEnabled(address) external returns (bool) envfree;
    function safeContract.getNativeTokenBalance() external returns (uint256) envfree;
    function Executor.execute(
        address to,
        uint256 value,
        bytes memory,
        Enum.Operation,
        uint256
    ) internal returns (bool) => ExecTxCall(to, value);

    function safeContract.transferEth(address to, uint256 value) external envfree;

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

ghost address fallbackHandlerAddress {
    init_state axiom fallbackHandlerAddress == 0;
}

function ExecTxCall(address to, uint256 value) returns bool{
    safeContract.transferEth(to, value);
    return true;
}

// This is Safe's fallback handler storage slot:
// 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5
// converted to decimal because certora doesn't seem to support hex yet.
hook Sstore safeContract.(slot 49122629484629529244014240937346711770925847994644146912111677022347558721749) address newFallbackHandlerAddress STORAGE {
    fallbackHandlerAddress = newFallbackHandlerAddress;
}

definition reachableOnly(method f) returns bool =
    f.selector != sig:safeContract.setup(address[],uint256,address,bytes,address,address,uint256,address).selector
    && f.selector != sig:safeContract.simulateAndRevert(address,bytes).selector;

rule payForMissingFunds(method f,
        address sender,
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds) filtered {
    f -> reachableOnly(f)
} {
    require safeContract.isModuleEnabled(currentContract) == true;
    require fallbackHandlerAddress == currentContract;
    require missingAccountFunds > 0;

    calldataarg args;
    env e;

    uint256 balanceBefore = safeContract.getNativeTokenBalance();
    
    SUPPORTED_ENTRYPOINT();

    uint256 validationData = validateUserOp(e, userOp, dummyData, missingAccountFunds);

    uint256 balanceAfter = safeContract.getNativeTokenBalance();

    assert balanceAfter == assert_uint256(balanceBefore - missingAccountFunds);
}
