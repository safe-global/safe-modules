using SafeWebAuthnSignerSingleton as SafeWebAuthnSignerSingleton;

persistent ghost uint delegateSuccess;

hook DELEGATECALL(uint g, address addr, uint argsOffset, uint argsLength, uint retOffset, uint retLength) uint rc {
    // DELEGATECALL is used in this contract, but it only ever calls into the singleton.
    assert (executingContract != currentContract || addr == SafeWebAuthnSignerSingleton,
        "we should only `delegatecall` into the singleton."
    );
    delegateSuccess = rc;
}

/*
Property 11. Proxy - Immutability of Configuration Parameters (x, y, Singleton, verifier)
x, y, singleton and verifiers never changes after any function call.
Rule verified.
*/
rule configParametersImmutability {
    env e;
    method f;
    calldataarg args;

    address singletonBefore = currentContract._SINGLETON;
    uint256 xBefore = currentContract._X;
    uint256 yBefore = currentContract._Y;
    P256.Verifiers verifiersBefore = currentContract._VERIFIERS;

    f(e, args);

    address singletonAfter = currentContract._SINGLETON;
    uint256 xAfter = currentContract._X;
    uint256 yAfter = currentContract._Y;
    P256.Verifiers verifiersAfter = currentContract._VERIFIERS;
    
    assert singletonBefore == singletonAfter &&
           xBefore == xAfter &&
           yBefore == yAfter &&
           verifiersBefore == verifiersAfter;
}

/*
Property 12. Proxy - Delegate Call Integrity (calls the Singleton)
Hooking on delegate calls will make sure we'll get a violation if the singleton isn't the contract called.
Rule verified.
*/
rule delegateCallsOnlyToSingleton {
    env e;
    method f;
    calldataarg args;

    f(e, args);

    assert true;
}

/*
Property 13. Proxy - Fallback reverting conditions.
Fallback reverts iff the delegatecall didn't succeed. Data manipulation does not revert.
Rule verified.
*/
rule fallbackRevertingConditions(method f, calldataarg args) filtered { f -> f.isFallback } {
    env e;
    
    f@withrevert(e, args);

    assert lastReverted <=> delegateSuccess == 0;
}
