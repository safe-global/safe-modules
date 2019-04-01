pragma solidity ^0.5.0;

// @title DutchX Interface - Represents the allowed methods to be executed from the safe module DutchXModule
/// @author Denis Granha - <denis@gnosis.pm>
interface DutchXInterface {
	function deposit(address token, uint256 amount) external;
    function postSellOrder(address sellToken, address buyToken, uint256 auctionIndex, uint256 amount) external;
    function postBuyOrder(address sellToken, address buyToken, uint256 auctionIndex, uint256 amount) external;

    function claimTokensFromSeveralAuctionsAsBuyer(
        address[] calldata auctionSellTokens, 
        address[] calldata auctionBuyTokens,
        uint[] calldata auctionIndices, 
        address user
    ) external;

    function claimTokensFromSeveralAuctionsAsSeller(
        address[] calldata auctionSellTokens,
        address[] calldata auctionBuyTokens,
        uint[] calldata auctionIndices,
        address user
    ) external;

    function withdraw() external;
}