pragma solidity 0.4.24;

interface TokenPriceOracle {
    function getPrice(address token) public view returns (uint256, uint256);
}
