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