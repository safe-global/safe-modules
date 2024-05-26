/* Setup Artifacts
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

use builtin rule sanity filtered { f -> f.contract == currentContract }

use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
use builtin rule msgValueInLoopRule;
use builtin rule viewReentrancy;
use rule privilegedOperation filtered { f -> f.contract == currentContract }
use rule timeoutChecker filtered { f -> f.contract == currentContract }
use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
use rule noRevert filtered { f -> f.contract == currentContract }
use rule alwaysRevert filtered { f -> f.contract == currentContract }
*/

using SafeWebAuthnSignerSingleton as SafeWebAuthnSignerSingleton;

hook DELEGATECALL(uint g, address addr, uint argsOffset, uint argsLength, uint retOffset, uint retLength) uint rc {
    // DELEGATECALL is used in this contract, but it only ever calls into the singleton.
    assert (executingContract != currentContract || addr == SafeWebAuthnSignerSingleton,
        "we should only `delegatecall` into the singleton."
    );
}

rule delegateCallsOnlyToSingleton {
    env e;
    method f;
    calldataarg args;

    f(e, args);

    assert true;
}

/*
Rule: Proxy Configuration Paramateres Never Change -- Passed
*/
rule configParametersImmutability {
    env e;
    method f;
    calldataarg args;

    address singletonBefore = currentContract._SINGLETON;
    uint256 xBefore = currentContract._X;
    uint256 yBefore = currentContract._Y;
    P256.Verifiers verifiersBefore = currentContract._VERIFIERS;

    f(e, args);

    address singletonAfter = currentContract._SINGLETON;
    uint256 xAfter = currentContract._X;
    uint256 yAfter = currentContract._Y;
    P256.Verifiers verifiersAfter = currentContract._VERIFIERS;
    
    assert singletonBefore == singletonAfter &&
           xBefore == xAfter &&
           yBefore == yAfter &&
           verifiersBefore == verifiersAfter;
}
