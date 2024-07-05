// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.20;

contract Benchmarker {
    function call(address to, bytes memory data) external returns (uint256 gas, bytes memory returnData) {
        gas = gasleft();

        bool success;
        (success, returnData) = to.call(data);
        if (!success) {
            // solhint-disable-next-line no-inline-assembly
            assembly ("memory-safe") {
                revert(add(returnData, 32), mload(returnData))
            }
        }

        gas = gas - gasleft();
    }
}
