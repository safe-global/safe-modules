methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;

    function _.execTransactionFromModule(
        address,
        uint256,
        bytes,
        Enum.Operation
    ) external => ExecTxCalled() expect bool; 


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

ghost bool execTransactionFromModuleCalled {
    init_state axiom false;
}

function ExecTxCalled() returns bool {
    execTransactionFromModuleCalled = true;
    return true;
}


rule execTransaction(method f) {
    calldataarg args;
    env e;

    f(e, args);
    assert execTransactionFromModuleCalled => f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector ||
            f.selector == sig:executeUserOp(address,uint256,bytes,uint8).selector ||
            f.selector == sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector;
}
