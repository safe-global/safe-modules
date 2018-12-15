pragma solidity ^0.5.0;

contract DutchExchange {
    function getPriceOfTokenInLastAuction(
        address token
    ) public view returns (uint256, uint256) {
        return (1, 2);
    }
    
    function getPriceInPastAuction(
        address token,
        address token2,
        uint auctionIndex
    ) public view returns (uint256, uint256) {  
        return (0, 0);
    }
    
    function getAuctionIndex(
        address token,
        address token2
    ) public view returns (uint256) {
        return 0;
    }
}
