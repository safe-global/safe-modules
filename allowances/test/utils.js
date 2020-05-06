module.exports = function (web3) {
    function sendRpc(method, params) {
        return new Promise(function (resolve) {
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: method,
            params: params || [],
            id: new Date().getTime()
          }, function (err, res) {
            resolve(res);
          });
        });
      }
      function waitUntilBlock(seconds, targetBlock) {
        return new Promise(function (resolve) {
          var asyncIterator = function asyncIterator() {
            return web3.eth.getBlock('latest', function (e, _ref) {
              var number = _ref.number;
    
              if (number >= targetBlock - 1) {
                return sendRpc('evm_increaseTime', [seconds]).then(function () {
                  return sendRpc('evm_mine');
                }).then(resolve);
              }
              return sendRpc('evm_mine').then(asyncIterator);
            });
          };
          asyncIterator();
        });
      }
      function wait() {
        var seconds = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 20;
        var blocks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
    
        return new Promise(function (resolve) {
          return web3.eth.getBlock('latest', function (e, _ref2) {
            var number = _ref2.number;
    
            resolve(blocks + number);
          });
        }).then(function (targetBlock) {
          return waitUntilBlock(seconds, targetBlock);
        });
      }
      return { wait: wait, waitUntilBlock: waitUntilBlock };
}