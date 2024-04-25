import "../ERC20/erc20cvl.spec";
import "../ERC20/WETHcvl.spec";
import "../ERC721/erc721.spec";
import "../ERC1967/erc1967.spec";
import "../PriceAggregators/chainlink.spec";
import "../PriceAggregators/tellor.spec";

import "../problems.spec";
import "../unresolved.spec";
import "../optimizations.spec";

import "../generic.spec"; // pick additional rules from here

use builtin rule sanity filtered { f -> f.contract == currentContract }

use builtin rule hasDelegateCalls filtered { f -> f.contract == currentContract }
use builtin rule msgValueInLoopRule;
use builtin rule viewReentrancy;
use rule privilegedOperation filtered { f -> f.contract == currentContract }
use rule timeoutChecker filtered { f -> f.contract == currentContract }
use rule simpleFrontRunning filtered { f -> f.contract == currentContract }
use rule noRevert filtered { f -> f.contract == currentContract }
use rule alwaysRevert filtered { f -> f.contract == currentContract }