
function getCurrentBlockTime() {
    return web3.eth.getBlock(web3.eth.blockNumber).timestamp
}

function fastForwardBlockTime(seconds) {
    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_increaseTime",
        params: [seconds], id: 0
    })

    web3.currentProvider.send({
        jsonrpc: "2.0",
        method: "evm_mine",
        params: [], id: 0
    })
}

function getUtcDateTime(blockTime) {
    const date  = new Date(blockTime * 1000);

    return {
        year  : date.getUTCFullYear(),
        month : date.getUTCMonth(),
        day   : date.getUTCDate(),
        hour  : date.getUTCHours()
    }
}

function getBlockTimeNextMonth(blockTime) {
    const dateTime = getUtcDateTime(blockTime);

    if(dateTime.month == 11) {
        return Date.UTC(dateTime.year + 1, 0, dateTime.day, dateTime.hour, 0, 0) / 1000
    } else {
        return Date.UTC(dateTime.year, dateTime.month + 1, dateTime.day, dateTime.hour, 0, 0) / 1000
    }
}


Object.assign(exports, {
    getCurrentBlockTime,
    fastForwardBlockTime,
    getUtcDateTime,
    getBlockTimeNextMonth
});
