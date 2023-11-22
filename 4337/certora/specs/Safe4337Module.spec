using ISafe as safe;

methods {
    function SUPPORTED_ENTRYPOINT() external returns(address) envfree;
    function _._msgSender() internal => ERC2771MessageSender() expect address;
    function _.checkSignatures(bytes32, bytes, bytes) external => CONSTANT;

    // Optional
    function validateUserOp(Safe4337Module.UserOperation,bytes32,uint256) external returns(uint256);
    function executeUserOp(address, uint256, bytes, uint8) external;
    function executeUserOpWithErrorString(address, uint256, bytes, uint8) external;
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
rule checkSignaturesIsCalledIfValidateUserOpSucceeds(method f, address sender, 
        bytes transactionHash,
        bytes signatures) filtered {
    f -> f.selector == sig:validateUserOp(Safe4337Module.UserOperation,bytes32,uint256).selector
} {
    env e;
    calldataarg args;

    safe.checkSignatures@withrevert(e, transactionHash, signatures);
    bool checkSignaturesOk = !lastReverted;

    f(e, args);
    assert checkSignaturesOk, "transaction executed without valid signatures";
}