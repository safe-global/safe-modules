// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test Token", "TT") public {
        _mint(msg.sender, 10000000);
    }
}