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
    function _.createSigner(uint256 x, uint256 y, P256.Verifiers verifiers) external => HAVOC_ECF;
    function _.isValidSignatureForSigner(bytes32 message, bytes signature, uint256 x, uint256 y, P256.Verifiers verifiers) external => HAVOC_ECF;
    function _.setup(
        address[] _owners,
        uint256 _threshold,
        address to,
        bytes data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address paymentReceiver
    ) external => HAVOC_ECF;
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