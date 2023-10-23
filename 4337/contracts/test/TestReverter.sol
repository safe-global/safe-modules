// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

contract TestReverter {
    function alwaysReverting() external pure {
        revert("You called a function that always reverts");
    }
}
