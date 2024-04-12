// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.23;

struct Call {
    address target;
    uint256 value;
    bytes data;
}

interface IStandardExecutor {
    function execute(address target, uint256 value, bytes calldata data) external payable returns (bytes memory);

    function executeBatch(Call[] calldata calls) external payable returns (bytes[] memory);
}
