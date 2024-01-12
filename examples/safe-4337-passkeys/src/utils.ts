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

export { numberToUnpaddedHex }
