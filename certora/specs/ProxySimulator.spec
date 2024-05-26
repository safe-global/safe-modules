using SafeWebAuthnSignerProxy as SafeWebAuthnSignerProxy;

definition MAGIC_VALUE() returns bytes4 = to_bytes4(0x1626ba7e);

methods {
    function authenticate(bytes32, bytes) external returns (bytes4) envfree;
    function _._ external => DISPATCH [
        SafeWebAuthnSignerProxy._
    ] default NONDET;
}

rule proxyReturnValue {
    bytes32 message;
    bytes signature;

    bytes4 ret = authenticate(message, signature);

    assert ret == MAGIC_VALUE();
}
