using Account as SafeAccount;
using Safe4337Module as Safe4337Module;

methods {
    function Account.execTransactionFromModule(
        address to,
        uint256 value ,
        bytes data,
        Enum.Operation operation
    ) external returns(bool) => ExecTxCalled(); 


    // Optional
    function validateUserOp(Safe4337Module.PackedUserOperation,bytes32,uint256) external returns(uint256);
    function executeUserOp(address, uint256, bytes, uint8) external;
    function executeUserOpWithErrorString(address, uint256, bytes, uint8) external;

    function Account.isModuleEnabled(address) external returns (bool) envfree;
}

persistent ghost bool execTransactionFromModuleCalled {
    init_state axiom false;
}

function ExecTxCalled() returns bool {
    execTransactionFromModuleCalled = true;
    return true;
}

// rule transactionExecutionMethods(method f) filtered { f->
//     f.selector != sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector &&
//     f.selector != sig:executeUserOp(address,uint256,bytes,uint8).selector &&
//     f.selector != sig:executeUserOpWithErrorString(address,uint256,bytes,uint8).selector
// } {
//     calldataarg args;
//     env e;
//     require !execTransactionFromModuleCalled;
//     f(e, args);
//     assert !execTransactionFromModuleCalled;
// }

rule entryPointTransactionMethods(EntryPoint.UserOperation userOp) {
    require userOp.sender == SafeAccount;
    require SafeAccount.isModuleEnabled(Safe4337Module);

    env e;
    address beneficiary;
    handleOps(e, [userOp], beneficiary);
    assert !execTransactionFromModuleCalled;
}
