// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract HariWillibaldToken is ERC20, ERC20Permit {
    constructor(address initialMintDest) ERC20("Hari Willibald Token", "HWT") ERC20Permit("Hari Willibald Token") {
        _mint(initialMintDest, 1000000 * 10**decimals());
    }
}
