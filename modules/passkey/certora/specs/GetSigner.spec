/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 getSigner is unique for every x,y and verifier combination, proved with assumptions: 
    1.)      value before cast to address <= max_uint160.
    2.)      munging required to complete signer data to be constructed from full 32bytes size arrays 
        function getSignerHarnessed(uint256 x, uint256 y, P256.Verifiers verifiers) public view returns (uint256 value) {
        bytes32 codeHash = keccak256(
            abi.encodePacked(
                type(SafeWebAuthnSignerProxy).creationCode,
                "01234567891011121314152546", <--------------- HERE!
                uint256(uint160(address(SINGLETON))),
                x,
                y,
                uint256(P256.Verifiers.unwrap(verifiers))
            )
        );
        value = uint256(keccak256(abi.encodePacked(hex"ff", address(this), bytes32(0), codeHash)));
    }                  
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

// helper rule to justify the use of the harnessed implementation (proved).
rule mungedEquivalence()
{
    env e1;
    env e2;

    require e1.msg.value == 0 && e2.msg.value == 0;
    uint256 x;
    uint256 y;
    P256.Verifiers verifier;

    storage s = lastStorage;

    uint256 harnessedSignerValue = getSignerHarnessed@withrevert(e1, x, y, verifier);
    bool harnessedSignerRevert1 = lastReverted;

    address harnessedSigner = castToAddress@withrevert(e1, harnessedSignerValue);
    bool harnessedSignerRevert2 = harnessedSignerRevert1 && lastReverted;

    address signer = getSigner@withrevert(e2, x, y, verifier) at s;
    bool signerRevert = lastReverted;

    assert (harnessedSignerRevert2 == signerRevert);
    assert (!harnessedSignerRevert2 && !signerRevert) => (harnessedSigner == signer);
}

rule uniqueSigner(){
    env e;

    uint256 firstX;
    uint256 firstY;
    P256.Verifiers firstVerifier;

    uint256 firstSignerValue = getSignerHarnessed(e, firstX, firstY, firstVerifier);
    require firstSignerValue <= max_uint160; // <=== needed assumption

    address firstSigner = castToAddress(e, firstSignerValue);

    uint256 secondX;
    uint256 secondY;
    P256.Verifiers secondVerifier;

    uint256 secondSignerValue = getSignerHarnessed(e, secondX, secondY, secondVerifier);
    require secondSignerValue <= max_uint160; // <=== needed assumption

    address secondSigner = castToAddress(e, secondSignerValue);

    assert firstSigner == secondSigner <=> (firstX == secondX && firstY == secondY && firstVerifier == secondVerifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Deterministic address in get signer (Proved)                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule deterministicSigner()
{
    env e1;
    env e2;

    uint x;
    uint y;
    P256.Verifiers verifier;

    address signer = getSigner(e1, x, y, verifier);

    assert signer == getSigner(e2, x, y, verifier);
}