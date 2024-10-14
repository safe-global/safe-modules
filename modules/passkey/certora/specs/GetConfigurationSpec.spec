using GetConfigurationProxyHarness as proxy;

methods {
    function GetConfigurationProxyHarness.getX() external returns (uint256) envfree;
    function GetConfigurationProxyHarness.getY() external returns (uint256) envfree;
    function GetConfigurationProxyHarness.getVerifiers() external returns (P256.Verifiers) envfree;

    function _._ external => DISPATCH [
        SafeWebAuthnSignerSingleton.getConfiguration()
    ] default HAVOC_ALL;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ getConfiguration Function (Integrity)                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule verifyGetConfigurationIntegrity(env e){

    uint256 x;
    uint256 y;
    P256.Verifiers verifiers;
    uint256 new_x; uint256 new_y; P256.Verifiers new_verifiers;
    bytes32 message;

    x = proxy.getX();
    y = proxy.getY();
    verifiers = proxy.getVerifiers();
    (new_x, new_y, new_verifiers) = proxy.getConfiguration(e);

    assert x == new_x;
    assert y == new_y;
    assert verifiers == new_verifiers;
    satisfy true;
}
