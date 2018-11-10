/* global artifacts */
/* eslint no-undef: "error" */

const migrateDx = require('@gnosis.pm/dx-contracts/src/migrations')

module.exports = function (deployer, network, accounts) {
  return migrateDx({
    artifacts,
    deployer,
    network,
    accounts,
    web3,
    thresholdNewTokenPairUsd: process.env.THRESHOLD_NEW_TOKEN_PAIR_USD,
    thresholdAuctionStartUsd: process.env.THRESHOLD_AUCTION_START_USD
  })
}