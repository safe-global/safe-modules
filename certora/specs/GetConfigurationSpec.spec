using Utilities as utilities;
using SafeWebAuthnSignerProxy as proxy;

methods {
    function _._ external => DISPATCH [ SafeWebAuthnSignerProxy._, SafeWebAuthnSignerSingleton._ ] default HAVOC_ALL;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ getConfiguration Function (Integrity)                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule configGetConfiguration {
    env e;

    uint256 xBefore = currentContract._X;
    uint256 yBefore = currentContract._Y;
    P256.Verifiers verifiersBefore = currentContract._VERIFIERS;

    uint256 xAfter;
    uint256 yAfter;
    P256.Verifiers verifiersAfter;

    xAfter, yAfter, verifiersAfter = utilities.getConfiguration(e, proxy);


    assert xBefore == xAfter &&
           yBefore == yAfter &&
           verifiersBefore == verifiersAfter;
    satisfy true;
}

