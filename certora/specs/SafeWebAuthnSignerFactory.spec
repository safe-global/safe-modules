using SafeWebAuthnSignerProxy as proxy;
using SafeWebAuthnSignerSingleton as singleton;
using WebAuthnHarnessWithMunge as WebAuthnHarness;


methods{
    function getSigner(uint256 x, uint256 y, P256.Verifiers v) internal returns (address) => getSignerGhost(x, y, v);
    function createSigner(uint256, uint256, P256.Verifiers) external returns (address);
    function hasNoCode(address) external returns (bool) envfree;
    
    function P256.verifySignatureAllowMalleability(P256.Verifiers a, bytes32 b, uint256 c, uint256 d, uint256 e, uint256 f) internal returns (bool) => 
    verifySignatureAllowMalleabilityGhost(a, b, c, d, e, f);

    function WebAuthn.encodeSigningMessage(bytes32 challenge, bytes calldata authenticatorData, string calldata clientDataFields) internal returns (bytes memory) =>
    GETencodeSigningMessageCVL(challenge, authenticatorData, clientDataFields);

    function WebAuthnHarness.checkInjective(bytes32 challenge, bytes32 authenticatorData, bytes32 clientDataFields, bytes32 result) internal returns (bool) =>
    checkInjectiveSummary(challenge, authenticatorData, clientDataFields, result);
    function _.isValidSignature(bytes32,bytes) external => DISPATCHER(optimistic=true, use_fallback=true);

    function _._ external => DISPATCH [
        proxy._,
        singleton._
    ] default NONDET;
}

ghost mapping(bytes32 => mapping(bytes32 => mapping(bytes32 => bytes32))) componentToEncodeHash;
ghost mapping(bytes32 => bytes32) revChallenge;
ghost mapping(bytes32 => bytes32) revAuthenticator;
ghost mapping(bytes32 => bytes32) revClientData;

function GETencodeSigningMessageCVL(bytes32 challenge, bytes authenticatorData, string clientDataFields) returns bytes {
    bytes32 authHash = keccak256(authenticatorData);
    bytes32 clientHash = keccak256(clientDataFields);
    bytes32 toRetHash = componentToEncodeHash[challenge][authHash][clientHash];
    require(revChallenge[toRetHash] == challenge);
    require(revAuthenticator[toRetHash] == authHash);
    require(revClientData[toRetHash] == clientHash);
    bytes toRet;
    require keccak256(toRet) == toRetHash;
    return toRet;
}

ghost checkInjectiveSummary(bytes32, bytes32, bytes32, bytes32) returns bool {
    axiom forall bytes32 x1. forall bytes32 y1. forall bytes32 z1. forall bytes32 x2. forall bytes32 y2. forall bytes32 z2. forall bytes32 result.
    checkInjectiveSummary(x1, y1, z1, result) && checkInjectiveSummary(x2, y2, z2, result) => x1 == x2;
}

ghost verifySignatureAllowMalleabilityGhost(P256.Verifiers, bytes32, uint256, uint256, uint256, uint256) returns bool {
    axiom forall P256.Verifiers a. forall bytes32 message1. forall bytes32 message2. forall uint256 c. forall uint256 d. forall uint256 e. forall uint256 f.
        verifySignatureAllowMalleabilityGhost(a, message1, c, d, e, f) && 
        verifySignatureAllowMalleabilityGhost(a, message2, c, d, e, f) => message1 == message2;
}

// Summary is correct only if the unique signer rule is proved spec GetSigner
ghost getSignerGhost(uint256, uint256, P256.Verifiers) returns address {
    axiom forall uint256 x1. forall uint256 y1. forall P256.Verifiers v1.
    forall uint256 x2. forall uint256 y2. forall P256.Verifiers v2.
    (getSignerGhost(x1, y1, v1) == getSignerGhost(x2, y2, v2)) <=> (x1 == x2 && y1 == y2 && v1 == v2); 
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
│ createSigner and getSigner always returns the same address   (Proved under assumption)                              │
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
│ Correctness of Signer Creation. (Cant called twice and override) (Bug CERT-6252)                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

ghost mathint numOfCreation;
ghost mapping(address => uint) address_map;
ghost address signerAddress;

hook CREATE2(uint value, uint offset, uint length, bytes32 salt) address v{
    require(v == signerAddress);
    numOfCreation = numOfCreation + 1;
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

    signerAddress = getSigner(e, x, y, verifier);
    require(numOfCreation == 0);
    require(hasNoCode(e, signerAddress));
    require(WebAuthnHarness.castSignatureSuccess(e, message, signature));


    storage s = lastStorage;

    bytes4 magic1 = isValidSignatureForSigner(e, message, signature, x, y, verifier);

    bytes4 magic2 = createAndVerify(e, message, signature, x, y, verifier) at s;

    assert magic1 == magic2 && numOfCreation == 1;
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ isValidSignatureForSigner Consistency (Proved)                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule isValidSignatureForSignerConsistency(method f) filtered { 
    f -> f.selector != sig:WebAuthnHarness.encodeClientDataJson(bytes32,string).selector
} {
    env e;
    env e1;
    env e2;
    require e1.msg.value == 0 && e2.msg.value == 0;

    calldataarg args;

    uint x;
    uint y;
    P256.Verifiers verifier;
    
    bytes signature;
    bytes32 message;

    bytes4 magic1 = isValidSignatureForSigner@withrevert(e1, message, signature, x, y, verifier);
    bool firstRevert = lastReverted;

    f(e, args);

    bytes4 magic2 = isValidSignatureForSigner@withrevert(e2, message, signature, x, y, verifier);
    bool secondRevert = lastReverted;

    assert firstRevert == secondRevert;
    assert (!firstRevert && !secondRevert) => (magic1 == MAGIC_VALUE()) <=> (magic2 == MAGIC_VALUE());
}


/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ isValidSignatureForSigner Integrity (Violated)                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule isValidSignatureForSignerIntegrity()
{
    env e;

    uint x;
    uint y;
    P256.Verifiers verifier;
    bytes signature;
    bytes32 message;

    bytes4 magic1 = isValidSignatureForSigner(e, message, signature, x, y, verifier);
    
    satisfy magic1 == MAGIC_VALUE();
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
