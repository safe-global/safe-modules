using SafeWebAuthnSignerProxy as proxy;
using SafeWebAuthnSignerSingleton as singleton;

methods{
    function getSigner(uint256 x, uint256 y, P256.Verifiers v) internal returns (address) => getSignerGhost(x, y, v);
    function createSigner(uint256, uint256, P256.Verifiers) external returns (address);
    function hasNoCode(address) external returns (bool) envfree;
}

definition MAGIC_VALUE() returns bytes4 = to_bytes4(0x1626ba7e);

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Singleton implementation never change (Proved)                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule singletonNeverChanges()
{
    env e;
    method f;
    calldataarg args;
    address currentSingleton = currentContract.SINGLETON;

    f(e, args);

    assert currentSingleton == currentContract.SINGLETON;
}



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

// helper rule to justify the use of the munged implementation (proved) need to drop getSigner summary before execution.
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
    require firstSignerValue <= max_uint160;

    address firstSigner = castToAddress(e, firstSignerValue);

    uint256 secondX;
    uint256 secondY;
    P256.Verifiers secondVerifier;

    uint256 secondSignerValue = getSignerHarnessed(e, secondX, secondY, secondVerifier);
    require secondSignerValue <= max_uint160;

    address secondSigner = castToAddress(e, secondSignerValue);


    assert firstSigner == secondSigner <=> (firstX == secondX && firstY == secondY && firstVerifier == secondVerifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ createSigner and getSigner always returns the same address   (Proved under assumption)                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

// Summary is correct only if the unique signer rule is proved !!! 
ghost getSignerGhost(uint256, uint256, P256.Verifiers) returns address {
    axiom forall uint256 x1. forall uint256 y1. forall P256.Verifiers v1.
    forall uint256 x2. forall uint256 y2. forall P256.Verifiers v2.
    (getSignerGhost(x1, y1, v1) == getSignerGhost(x2, y2, v2)) <=> (x1 == x2 && y1 == y2 && v1 == v2); 
}

rule createAndGetSignerEquivalence(){
    env e;

    uint256 createX;
    uint256 createY;
    P256.Verifiers createVerifier;

    address signer1 = createSigner(e, createX, createY, createVerifier);

    uint256 getX;
    uint256 getY;
    P256.Verifiers getVerifier;
    
    address signer2 = getSigner(e, getX, getY, getVerifier);
    
    assert signer1 == signer2 <=> (createX == getX && createY == getY && createVerifier == getVerifier);
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

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Correctness of Signer Creation. (Cant called twice and override) (Bug CERT-6252)                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

ghost mathint numOfCreation;
ghost mapping(address => uint) address_map;

hook EXTCODESIZE(address addr) uint v{
    require address_map[addr] == v;
}

hook CREATE2(uint value, uint offset, uint length, bytes32 salt) address v{
    numOfCreation = numOfCreation + 1;
    address_map[v] = length;
}

rule SignerCreationCantOverride()
{
    env e;
    require numOfCreation == 0;

    uint x;
    uint y;
    P256.Verifiers verifier;

    address a = getSigner(e, x, y, verifier);
    require address_map[a] == 0;

    createSigner(e, x, y, verifier);
    createSigner@withrevert(e, x, y, verifier);

    assert numOfCreation < 2;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Has no code integrity  (Proved)                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule hasNoCodeIntegrity()
{
    address a;
    assert (a == proxy) => !hasNoCode(a);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ isValidSignatureForSigner equiv to first deploying the signer with the factory, and then                            |
|     verifying the signature with it directly (CERT-6221)                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule createAndVerifyEQtoIsValidSignatureForSigner()
{
    env e;
    uint x;
    uint y;
    P256.Verifiers verifier;
    bytes signature;
    bytes32 message;

    storage s = lastStorage;

    bytes4 magic1 = isValidSignatureForSigner(e, message, signature, x, y, verifier);

    bytes4 magic2 = createAndVerify(e, message, signature, x, y, verifier) at s;

    assert magic1 == magic2;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ isValidSignatureForSigner Consistency                                                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule isValidSignatureForSignerConsistency()
{
    env e;
    method f;
    calldataarg args;

    uint x;
    uint y;
    P256.Verifiers verifier;
    
    bytes signature;
    bytes32 message;

    bytes4 magic1 = isValidSignatureForSigner(e, message, signature, x, y, verifier);

    f(e, args);

    bytes4 magic2 = isValidSignatureForSigner(e, message, signature, x, y, verifier);

    assert (magic1 == MAGIC_VALUE()) <=> (magic2 == MAGIC_VALUE());
}