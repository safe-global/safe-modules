// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";

contract StakedFactoryProxy {
    address public immutable FACTORY;

    constructor(address factory) payable {
        require(factory != address(0), "Invalid factory");
        FACTORY = factory;
    }

    fallback() external {
        (bool success, bytes memory result) = FACTORY.call(msg.data);
        if (success) {
            assembly ("memory-safe") {
                return(add(result, 32), mload(result))
            }
        } else {
            assembly ("memory-safe") {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function stakeEntryPoint(IEntryPoint entryPoint, uint32 unstakeDelaySecs) external payable {
        entryPoint.addStake{value: msg.value}(unstakeDelaySecs);
    }
}
