using SafeWebAuthnSignerProxy as SafeWebAuthnSignerProxy;

definition MAGIC_VALUE() returns bytes4 = to_bytes4(0x1626ba7e);

methods {
    function authenticate(bytes32, bytes) external returns (bytes4) envfree;
    function _._ external => DISPATCH [
        SafeWebAuthnSignerProxy._
    ] default NONDET;
}

/*
Property 14. Proxy - verify return data from the fallback is only one of the magicNumbers
Uses another contract that simulates interaction with the proxy. The reason is that the prover doesn't check all
possible calldata values so this simualtion will make the prover choose different values that will be passed on the calldata.
Rule stuck.
*/
rule proxyReturnValue {
    bytes32 message;
    bytes signature;

    bytes4 ret = authenticate(message, signature);

    assert ret == MAGIC_VALUE();
}
