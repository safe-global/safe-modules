// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

abstract contract Base6900 {
    /**
     * @notice Address of this contract
     */
    address public immutable SELF;

    /**
     * @notice Constructor
     */
    constructor() {
        SELF = address(this);
    }

    /**
     * @notice Modifier to make a function callable via delegatecall only.
     * If the function is called via a regular call, it will revert.
     */
    modifier onlyDelegateCall() {
        require(address(this) != SELF, "must only be called via delegatecall");
        _;
    }
}
