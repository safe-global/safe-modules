pragma solidity ^0.5.0;

contract DutchExchange {
    function getPriceOfTokenInLastAuction(
        address token
    ) external view returns (uint256, uint256) {
        return (0, 0);
    }
    
    function getPriceInPastAuction(
        address token,
        address token2,
        uint auctionIndex
    ) external view returns (uint256, uint256) {
        return (0, 0);
    }
    
    function getAuctionIndex(
        address token,
        address token2
    ) external view returns (uint256) {
        return 0;
    }
}
