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
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Singleton implementation never change                                                                               │
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
│ getSigner is unique for every x,y and verifier combination                                                          │
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
│ createSigner and getSigner always returns the same address                                                          │
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