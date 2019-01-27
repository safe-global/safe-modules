pragma solidity ^0.5.0;

import "../TransferLimitModule.sol";

contract TransferLimitModuleMock is TransferLimitModule {
    uint256 price;

    function setPrice(uint256 _price) external {
        price = _price;
    }

    function getDaiAmount(uint256 _num, uint256 _det) internal view returns (uint256, uint256) {
        return price != 0 ? (_num * price, _det) : super.getDaiAmount(_num, _det);
    }
}
