/**
 * Converts a number to an unpadded hexadecimal string.
 * Metamask requires unpadded chain id for wallet_switchEthereumChain and wallet_addEthereumChain.
 *
 * @param n - The number to convert.
 * @param withPrefix - Whether to include the "0x" prefix in the result. Default is true.
 * @returns The unpadded hexadecimal string representation of the number.
 */
function numberToUnpaddedHex(n: number, withPrefix = true): string {
  const hex = n.toString(16)
  return `${withPrefix ? '0x' : ''}${hex}`
}

/**
 * Generates a random 256-bit unsigned integer.
 *
 * @returns {bigint} A random 256-bit unsigned integer.
 *
 * This function uses the Web Crypto API's `crypto.getRandomValues()` method to generate
 * a uniformly distributed random value within the range of 256-bit unsigned integers
 * (from 0 to 2^256 - 1).
 */
function getRandomUint256(): bigint {
  const dest = new Uint8Array(32) // Create a typed array capable of storing 32 bytes or 256 bits

  crypto.getRandomValues(dest) // Fill the typed array with cryptographically secure random values

  let result = 0n
  for (let i = 0; i < dest.length; i++) {
    result |= BigInt(dest[i]) << BigInt(8 * i) // Combine individual bytes into one bigint
  }

  return result
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * @param hexString The hexadecimal string to convert.
 * @returns The Uint8Array representation of the hexadecimal string.
 */
function hexStringToUint8Array(hexString: string): Uint8Array {
  const arr = []
  for (let i = 0; i < hexString.length; i += 2) {
    arr.push(parseInt(hexString.substr(i, 2), 16))
  }
  return new Uint8Array(arr)
}

/**
 * Represents the status of a request.
 */
enum RequestStatus {
  NOT_REQUESTED,
  LOADING,
  SUCCESS,
  ERROR,
}

export { RequestStatus, numberToUnpaddedHex, getRandomUint256, hexStringToUint8Array }
