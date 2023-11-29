// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721Token is ERC721 {
    constructor() ERC721("ERC 721 Token", "ERC721") {}

    // @dev This can be called by anyone.
    function safeMint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId, "");
    }
}
