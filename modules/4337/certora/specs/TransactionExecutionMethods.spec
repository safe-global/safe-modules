using Account as SafeAccount;
using Safe4337Module as Safe4337Module;

methods {
    function _.execTransactionFromModule(
        address to,
        uint256 value ,
        bytes data,
        Enum.Operation operation
    ) external =>DISPATCHER(true); 
    function _.validateUserOp(
        Safe4337Module.PackedUserOperation userOp,
        bytes32,
        uint256 missingAccountFunds
    ) external => DISPATCHER(true);

    function SafeAccount.isModuleEnabled(address) external returns (bool) envfree;
    function SafeAccount.getSelectorFromData(bytes) external returns (uint32) envfree;
    function SafeAccount.getFallbackHandler() external returns (address) envfree;
    function SafeAccount.getNonceKey(uint256 nonce) external returns (uint192) envfree;
    function EntryPoint.getNonce(address, uint192) external returns (uint256) envfree;
}

persistent ghost bool execTransactionFromModuleCalled {
    init_state axiom false;
}

function ExecTxCalled() returns bool {
    execTransactionFromModuleCalled = true;
    return true;
}

function ValidateUserOp() returns uint256 {
    return 0;
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

// the last run: https://prover.certora.com/output/6575/ff08cb300bb447cf82f1f476bf86df1e?anonymousKey=5b6631266ebe8d014b97b8d5cd556e85d310e250
// rule entryPointTransactionExecutionMethods(EntryPoint.PackedUserOperation userOp) {
//     require userOp.sender == SafeAccount;
//     require SafeAccount.isModuleEnabled(Safe4337Module);
//     require SafeAccount.getFallbackHandler() == Safe4337Module;
//     require !execTransactionFromModuleCalled;

//     env e;
//     address beneficiary;
//     handleOps(e, [userOp], beneficiary);
//     uint32 selector = SafeAccount.getSelectorFromData(userOp.callData);
//     assert execTransactionFromModuleCalled => selector == sig:Safe4337Module.executeUserOp(address,uint256,bytes,uint8).selector ||
//         selector == sig:Safe4337Module.executeUserOpWithErrorString(address,uint256,bytes,uint8).selector;
// }


rule nonceMonotonicity(EntryPoint.PackedUserOperation userOp) {
    require userOp.sender == SafeAccount;
    require SafeAccount.isModuleEnabled(Safe4337Module);
    require SafeAccount.getFallbackHandler() == Safe4337Module;

    uint192 nonceKey = SafeAccount.getNonceKey(userOp.nonce);
    uint256 nonceBefore = getNonce(userOp.sender, nonceKey);

    env e;
    address beneficiary;
    handleOps(e, [userOp], beneficiary);
    assert !lastReverted => getNonce(userOp.sender, nonceKey) == assert_uint256(nonceBefore + 1);
}
