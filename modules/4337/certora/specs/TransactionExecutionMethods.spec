methods {
    function _.execTransactionFromModule(
        address,
        uint256,
        bytes,
        Enum.Operation
    ) external => ExecTxCalled() expect bool; 


    // Optional
    function validateUserOp(Safe4337Module.PackedUserOperation,bytes32,uint256) external returns(uint256);
    function executeUserOp(address, uint256, bytes, uint8) external;
    function executeUserOpWithErrorString(address, uint256, bytes, uint8) external;
}

persistent ghost bool execTransactionFromModuleCalled {
    init_state axiom false;
}

function ExecTxCalled() returns bool {
    execTransactionFromModuleCalled = true;
    return true;
}

rule transactionExecutionMethods(method f) filtered { f->
    f.selector != sig:validateUserOp(Safe4337Module.PackedUserOperation,bytes32,uint256).selector &&
    f.selector != sig:executeUserOp(address,uint256,bytes,uint8).selector &&
    f.selector != sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector
} {
    calldataarg args;
    env e;
    require !execTransactionFromModuleCalled;
    f(e, args);
    assert !execTransactionFromModuleCalled;
}
