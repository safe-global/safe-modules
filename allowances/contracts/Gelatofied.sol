// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.4;

abstract contract Gelatofied {

    // solhint-disable-next-line var-name-mixedcase
    address payable public immutable GELATO;

    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    constructor(address payable _gelato) {
        GELATO = _gelato;
    }

    modifier onlyGelato() {
        require(msg.sender == GELATO, "Gelatofied: Only gelato");
        _;
    }
}
