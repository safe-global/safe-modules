methods {
    function fallbackButNotDelegating(uint256,uint256,P256.Verifiers) external returns (bytes4);
}

/*
Property 13. Proxy - Fallback data corruption does not revert the fallback (uses data appending that needed to be verified).
The fallback will only revert due to payable modifier.
Rule Verified.
*/
rule fallbackDoesNotRevert {
    env e;
    uint256 x;
    uint256 y;
    P256.Verifiers verifiers;
    
    bool notEnoughEthSender = e.msg.value > nativeBalances[e.msg.sender];

    fallbackButNotDelegating@withrevert(e, x, y, verifiers);

    assert lastReverted <=> notEnoughEthSender;
}