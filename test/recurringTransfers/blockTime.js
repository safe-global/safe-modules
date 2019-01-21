
function getCurrentBlockTime() {
    return web3.eth.getBlock(web3.eth.blockNumber).timestamp
}

function getCurrentUtcDateTime() {
    return getUtcDateTimeFromBlockTime(getCurrentBlockTime())
}

function getUtcDateTimeFromBlockTime(blockTime) {
    const date  = new Date(blockTime * 1000);

    return {
        year  : date.getUTCFullYear(),
        month : date.getUTCMonth(),
        day   : date.getUTCDate(),
        hour  : date.getUTCHours()
    }
}

function getBlockTimeNextMonth(blockTime) {
    const dateTime = getUtcDateTimeFromBlockTime(blockTime);

    if(dateTime.month == 11) {
        return getBlockTimeFromDateTime({year: dateTime.year + 1, month: 0, day: dateTime.day, hour: dateTime.hour})
    } else {
        return getBlockTimeFromDateTime({year: dateTime.year, month: dateTime.month + 1, day: dateTime.day, hour: dateTime.hour})
    }
}

function getBlockTimeAtStartOfNextMonth(blockTime) {
    const dateTime = getUtcDateTimeFromBlockTime(blockTime);

    if(dateTime.month == 11) {
        return getBlockTimeFromDateTime({year: dateTime.year + 1, month: 0, day: 1, hour: 5})
    } else {
        return getBlockTimeFromDateTime({year: dateTime.year, month: dateTime.month + 1, day: 1, hour: 5})
    }
}

function getBlockTimeFromDateTime(dateTime) {
    return Date.UTC(dateTime.year, dateTime.month, dateTime.day, dateTime.hour, 0, 0) / 1000
}

Object.assign(exports, {
    getCurrentBlockTime,
    getCurrentUtcDateTime,
    getUtcDateTimeFromBlockTime,
    getBlockTimeNextMonth,
    getBlockTimeAtStartOfNextMonth,
    getBlockTimeFromDateTime
});
