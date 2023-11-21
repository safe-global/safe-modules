methods {
    function validateUserOp(UserOperation,bytes32,uint256) external returns(uint256); 
}

rule onlyEntryPointCallable (method f) filtered {
    f -> f.selector == sig:validateUserOp(UserOperation,bytes32,uint256).selector
} {
    calldataarg args;
    f(e,args);

    assert e.msg.sender != SUPPORTED_ENTRYPOINT() => lastReverted;
}