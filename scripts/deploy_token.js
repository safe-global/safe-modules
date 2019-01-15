const args = require('yargs').argv

const gnosisUtils = require('./utils')(this.web3)
const nodeUtils = require('util')

module.exports = async function(callback) {
  const accounts = await nodeUtils.promisify(this.web3.eth.getAccounts)()

  try {
    const token = await gnosisUtils.deployWETHToken(accounts[0])
  } catch(error) {
    callback(error)
  }
  // Close script
  callback()
}
