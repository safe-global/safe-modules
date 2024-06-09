using SafeWebAuthnSignerProxy as proxy;
using SafeWebAuthnSignerSingleton as singleton;

methods{
    function getSigner(uint256, uint256, P256.Verifiers) external returns (address);
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
│ getSigner is unique for every x,y and verifier combination    (Violated but low prob)                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
// consider adding the following munging after the creationcode to get a more clear dump 01234567891011121314152546

rule uniqueSigner(){
    env e;

    uint256 firstX;
    uint256 firstY;
    P256.Verifiers firstVerifier;

    address firstSigner = getSigner(e, firstX, firstY, firstVerifier);

    uint256 secondX;
    uint256 secondY;
    P256.Verifiers secondVerifier;

    address secondSigner = getSigner(e, secondX, secondY, secondVerifier);

    assert firstSigner == secondSigner <=> (firstX == secondX && firstY == secondY && firstVerifier == secondVerifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ createSigner and getSigner always returns the same address   (Violated but low prob)                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

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
ghost bool validValue;

hook EXTCODESIZE(address addr) uint v {
    require address_map[addr] == v;
    validValue = addr <= max_uint160;
}

hook CREATE2(uint value, uint offset, uint length, bytes32 salt) address v {
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

rule ValidValue()
{
    env e;
    require !validValue;

    uint x;
    uint y;
    P256.Verifiers verifier;

    createSigner(e, x, y, verifier);
    createSigner@withrevert(e, x, y, verifier);
    
    satisfy validValue;
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

rule getSignerRevertingConditions {
    env e;
    uint256 x;
    uint256 y;
    P256.Verifiers verifiers;

    bool triedTransferringEth = e.msg.value != 0;

    getSigner@withrevert(e, x, y, verifiers);

    assert lastReverted <=> triedTransferringEth;
}
