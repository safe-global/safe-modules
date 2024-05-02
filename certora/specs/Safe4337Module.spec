import "ERC20/erc20cvl.spec";
import "ERC20/WETHcvl.spec";
import "ERC721/erc721.spec";
import "ERC1967/erc1967.spec";
import "PriceAggregators/chainlink.spec";
import "PriceAggregators/tellor.spec";

import "problems.spec";
import "unresolved.spec";
import "optimizations.spec";

import "generic.spec"; // pick additional rules from here

methods {
    function _.isValidSignature(bytes data, bytes signatureData) external => DISPATCHER(true);
    function _.execTransactionFromModuleReturnData(address to, uint256 value, bytes data, uint8 operation) external => HAVOC_ECF;
    function _.execTransactionFromModule(address to, uint256 value, bytes data, uint8 operation) external => HAVOC_ECF;
    function _.checkSignatures(bytes32 dataHash, bytes data, bytes signatures) external => DISPATCHER(true);
    function _.domainSeparator() external => DISPATCHER(true);
    function _.getModulesPaginated(address start, uint256 pageSize) external => HAVOC_ECF;
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