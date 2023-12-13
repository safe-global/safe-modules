using Account as safeContract;

methods {
    //ISafe harnessed functions
    function safeContract.isModuleEnabled(address) external returns (bool) envfree;
    function safeContract.getNativeTokenBalance() external returns (uint256) envfree;

    // function safeContract.transferEth(address to, uint256 value) external envfree;

    // function safeContract.execTransactionFromModuleCalled() external returns(bool) envfree;

    function _.execTransactionFromModule(
        address,
        uint256,
        bytes,
        Enum.Operation
    ) external => DISPATCHER(true); // 

    // Optional
    function validateUserOp(Safe4337Module.UserOperation,bytes32,uint256) external returns(uint256);
}

// ghost bool execTransactionFromModuleCalled;

// function ExecTxCalled() returns bool {
//     execTransactionFromModuleCalled = true;
//     return true;
// }

ghost address fallbackHandlerAddress {
    init_state axiom fallbackHandlerAddress == 0;
}

// function ExecTxCall(address to, uint256 value) returns bool{
//     safeContract.transferEth(to, value);
//     return true;
// }

// This is Safe's fallback handler storage slot:
// 0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5
// converted to decimal because certora doesn't seem to support hex yet.
hook Sstore safeContract.(slot 49122629484629529244014240937346711770925847994644146912111677022347558721749) address newFallbackHandlerAddress STORAGE {
    fallbackHandlerAddress = newFallbackHandlerAddress;
}

rule payForMissingFunds(
        Safe4337Module.UserOperation userOp,
        bytes32 dummyData,
        uint256 missingAccountFunds)  {

    calldataarg args;
    env e;

    uint256 balanceBefore = safeContract.getNativeTokenBalance();
    require balanceBefore >= missingAccountFunds ;
    
    validateUserOp(e, userOp, dummyData, missingAccountFunds);

    uint256 balanceAfter = safeContract.getNativeTokenBalance();
    assert balanceAfter >= assert_uint256(balanceBefore - missingAccountFunds);
}
