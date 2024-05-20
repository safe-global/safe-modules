import "ERC20/erc20cvl.spec";
import "ERC20/WETHcvl.spec";
import "ERC721/erc721.spec";
import "ERC1967/erc1967.spec";
import "PriceAggregators/chainlink.spec";
import "PriceAggregators/tellor.spec";
import "spec_utils/problems.spec";
import "spec_utils/unresolved.spec";
import "spec_utils/optimizations.spec";
import "spec_utils/generic.spec"; // pick additional rules from here

methods{
    function getSigner(uint256, uint256, P256.Verifiers) external returns (address) envfree;
    function createSigner(uint256, uint256, P256.Verifiers) external returns (address) envfree;
    function hasNoCode(address) external returns (bool) envfree;
}


use builtin rule sanity filtered { f -> f.contract == currentContract }
use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
use builtin rule msgValueInLoopRule;
use builtin rule viewReentrancy;
use rule privilegedOperation filtered { f -> f.contract == currentContract }
use rule timeoutChecker filtered { f -> f.contract == currentContract }
use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
use rule noRevert filtered { f -> f.contract == currentContract }
use rule alwaysRevert filtered { f -> f.contract == currentContract }


/*
Factory   - Immutability of Singleton Contract.	 (Proved) [Critical]
Factory   - getSigner is unique for every x,y and verifier combination (Bug in prover CERT-6182) [High] 
Factory   - createSigner and getSigner always returns the same address.	 (Bug in prover CERT-6182) [Medium]
Factory   - Deterministic Address Calculation for Signers.													[High]
Factory   - Correctness of Signer Creation. (Cant called twice, override)									[Cannot understand the risk]
Factory   - Code Presence Check (_hasNoCode Integrity)	                                                    [Low]
Factory   - Signature Validation (isValidSignatureForSigner Integrity)										[Critical]

*/

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
│ getSigner is unique for every x,y and verifier combination    (Bug in prover CERT-6182)                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule uniqueSigner(){
    uint256 firstX;
    uint256 firstY;
    P256.Verifiers firstVerifier;

    address firstSigner = getSigner(firstX, firstY, firstVerifier);

    uint256 secondX;
    uint256 secondY;
    P256.Verifiers secondVerifier;

    address secondSigner = getSigner(secondX, secondY, secondVerifier);

    assert firstSigner == secondSigner <=> (firstX == secondX && firstY == secondY && firstVerifier == secondVerifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ createSigner and getSigner always returns the same address   (Bug in prover CERT-6182)                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

rule createAndGetSignerEquivalence(){
    uint256 createX;
    uint256 createY;
    P256.Verifiers createVerifier;

    address signer1 = createSigner(createX, createY, createVerifier);

    uint256 getX;
    uint256 getY;
    P256.Verifiers getVerifier;
    
    address signer2 = getSigner(getX, getY, getVerifier);
    
    assert signer1 == signer2 <=> (createX == getX && createY == getY && createVerifier == getVerifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Deterministic address in get signer (Proved)                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/
rule deterministicSigner()
{
    uint x;
    uint y;
    P256.Verifiers verifier;

    address signer = getSigner(x, y, verifier);

    assert signer == getSigner(x, y, verifier);
}

/*
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Correctness of Signer Creation. (Cant called twice and override) (Proved)                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
*/

ghost mathint numOfCreation;

hook CREATE2(uint value, uint offset, uint length, bytes32 salt) address v{
    require numOfCreation == numOfCreation + 1;
}

rule SignerCreationCantOverride()
{
    require numOfCreation == 0;

    uint x;
    uint y;
    P256.Verifiers verifier;

    createSigner(x, y, verifier);
    createSigner(x, y, verifier);

    assert numOfCreation < 2;
}