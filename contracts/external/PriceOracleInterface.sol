pragma solidity ^0.5.0;

interface PriceOracleInterface {
    function getUSDETHPrice() external view returns (uint256);
}
