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

// use builtin rule sanity filtered { f -> f.contract == currentContract }

// use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
// use builtin rule msgValueInLoopRule;
// use builtin rule viewReentrancy;
// use rule privilegedOperation filtered { f -> f.contract == currentContract }
// use rule timeoutChecker filtered { f -> f.contract == currentContract }
// use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
// use rule noRevert filtered { f -> f.contract == currentContract }
// use rule alwaysRevert filtered { f -> f.contract == currentContract }

methods{
    function encodeClientDataJson(bytes32 message,string calldata signature) internal returns string => encodeClientDataJsonSummary(message, signature);
}

ghost encodeClientDataJsonSummary(bytes32, string) returns string {
    axiom forall bytes32 x1. forall string y1. forall bytes32 x2. forall string y2. x1 != x2 => (
        encodeClientDataJsonSummary(x1, y1) != encodeClientDataJsonSummary(x2, y2));
}

rule encodeClientDataJsonIntegrity(){
    env e;

    bytes32 challenge1;
    string clientDataFields;
    bytes32 challenge2;

    string a1 = encodeClientDataJson(challenge1, clientDataFields);
    string b1 = encodeClientDataJson(challenge2, clientDataFields);

    require(challenge1 != challenge2);

    satisfy true;
}


rule shaIntegrity(){
    env e;
    
    bytes32 input1;
    bytes32 input2;
    
    bytes32 input1_sha = getSha256(e, input1);
    bytes32 input2_sha = getSha256(e, input2);
    
    assert (input1 != input2) <=> input1_sha != input2_sha;
}