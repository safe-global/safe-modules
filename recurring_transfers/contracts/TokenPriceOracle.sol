pragma solidity ^0.5.0;

interface TokenPriceOracle {
    function getPrice(address token) external view returns (uint256, uint256);
}
