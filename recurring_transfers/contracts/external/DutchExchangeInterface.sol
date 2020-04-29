pragma solidity ^0.5.0;

interface DutchExchange {
    function getPriceOfTokenInLastAuction(
        address token
    ) external view returns (uint num, uint den);
    
    function getPriceInPastAuction(
        address token1,
        address token2,
        uint auctionIndex
    ) external view returns (uint num, uint den);
    
    function getAuctionIndex(
        address token1,
        address token2
    ) external view returns (uint index);
}
