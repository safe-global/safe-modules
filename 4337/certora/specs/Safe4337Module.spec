
methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;
    function _._msgSender() internal => ERC2771MessageSender() expect address;

    // Optional
    function validateUserOp(Safe4337Module.UserOperation,bytes32,uint256) external returns(uint256);

}

ghost ERC2771MessageSender() returns address;

rule onlyEntryPointCallable(method f) filtered {
    f -> f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector
} {
    env e;
    calldataarg args;
    f(e, args);
    assert ERC2771MessageSender() == SUPPORTED_ENTRYPOINT();
}