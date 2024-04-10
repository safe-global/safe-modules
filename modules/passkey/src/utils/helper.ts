/**
 *  A constant for the maximum value for a ``uint256``.
 *
 *  (**i.e.** ``0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn``)
 */
export const MaxUint256: bigint = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

/**
 *  Returns true if %%value%% is a valid [[HexString]].
 *
 *  If %%length%% is ``true`` or a //number//, it also checks that
 *  %%value%% is a valid [[DataHexString]] of %%length%% (if a //number//)
 *  bytes of data (e.g. ``0x1234`` is 2 bytes).
 */
export function isHexString(value: string | ArrayBufferLike, length?: number | boolean): value is `0x${string}` {
  if (typeof value !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false
  }

  if (typeof length === 'number' && value.length !== 2 + 2 * length) {
    return false
  }
  if (length === true && value.length % 2 !== 0) {
    return false
  }

  return true
}

/**
 *  Returns true if %%value%% is a valid representation of arbitrary
 *  data (i.e. a valid [[DataHexString]] or a Uint8Array).
 */
export function isBytesLike(value: string | ArrayBufferLike): value is string {
  return isHexString(value, true) || value instanceof Uint8Array
}

/**
 *  Returns a Hex from the %%bytes%% (Uint8Array).
 */
export const toHexString = (bytes: Uint8Array) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')

/**
 *  Returns a Hex from the %%str%% string.
 */
function stringToHex(str: string): string {
  return str
    .split('')
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
}

/**
 *  Any type that can be used for encoding in the ABI.
 */
export type dataType = 'uint256' | 'bytes' | 'string' | 'address'

/**
 *  Encodes the given types and values into an ABI encoded bytes.
 */
export function encodeABI(types: string[], values: any[]) {
  // Check length equivalence between types and values
  if (types.length !== values.length) {
    throw new Error('types and values length mismatch')
  }
  let encoded = '0x'
  let offset = 32 * values.length // 32 bytes per value
  let dynamicData = '' // Dynamic data is stored separately at the end

  for (let i = 0; i < values.length; i++) {
    // Check the type of values
    if (types[i] === 'uint256') {
      // Encode the value in 32 bytes form
      let hexValue = values[i].toString(16)
      // Remove 0x if present in hexValue
      if (hexValue.slice(0, 2) === '0x') {
        hexValue = hexValue.slice(2)
      }
      // Add the value to the encoded data
      encoded += '0'.repeat(64 - hexValue.length) + hexValue
    } else if (types[i] === 'bytes') {
      // If type of values[i] == Uint8Array, then convert to Hex String, else slice(2) and add '00' at the start.
      let valueI = ''
      if (values[i] instanceof Uint8Array) {
        valueI = toHexString(values[i])
      } else {
        valueI = values[i].slice(2)
      }
      // Add the offset to the encoded data
      encoded += '0'.repeat(64 - offset.toString(16).length) + offset.toString(16)
      // Calculate the length of the value
      const reserveValueLength = Math.ceil(valueI.length / 64) + 1 // +1 is for the length parameter
      // Update the offset
      offset += reserveValueLength * 32
      // Adding the data length to the dynamic data
      const exactValueLength = Math.ceil(valueI.length / 2)
      dynamicData += '0'.repeat(64 - exactValueLength.toString(16).length) + exactValueLength.toString(16)
      // Adding the data to the dynamic data
      dynamicData += valueI + '0'.repeat((reserveValueLength - 1) * 64 - exactValueLength * 2)
    } else if (types[i] === 'string') {
      const valueI = stringToHex(values[i])
      // Add the offset to the encoded data
      encoded += '0'.repeat(64 - offset.toString(16).length) + offset.toString(16)
      // Calculate the length of the value
      const reserveValueLength = Math.ceil(valueI.length / 64) + 1 // +1 is for the length parameter
      // Update the offset
      offset += reserveValueLength * 32
      // Adding the data length to the dynamic data
      const exactValueLength = Math.ceil(valueI.length / 2)
      dynamicData += '0'.repeat(64 - exactValueLength.toString(16).length) + exactValueLength.toString(16)
      // Adding the data to the dynamic data
      dynamicData += valueI + '0'.repeat((reserveValueLength - 1) * 64 - exactValueLength * 2)
    } else if (types[i] === 'address') {
      // Check if the value has any non Hex characters
      if (!values[i].match(/^0x[0-9A-Fa-f]*$/)) {
        throw new Error('invalid address')
      }
      // Check if the value is a valid address
      if (values[i].length !== 42) {
        throw new Error('invalid address length')
      }
      // Encode the value in 32 bytes form
      encoded += '0'.repeat(24) + values[i].slice(2)
    } else {
      throw new Error('unsupported type')
    }
  }
  return encoded + dynamicData
}

/**
 *  Get a typed Uint8Array for %%value%%. If already a Uint8Array
 *  the original %%value%% is returned;
 */
function getBytes(value: string | Uint8Array, name?: string): Uint8Array {
  if (value instanceof Uint8Array) {
    return value
  }

  if (typeof value === 'string' && value.match(/^0x([0-9a-f][0-9a-f])*$/i)) {
    const result = new Uint8Array((value.length - 2) / 2)
    let offset = 2
    for (let i = 0; i < result.length; i++) {
      result[i] = parseInt(value.substring(offset, offset + 2), 16)
      offset += 2
    }
    return result
  }

  throw new Error('invalid BytesLike value' + name)
}

/**
 *  Encodes %%data%% as a base-64 encoded string.
 *
 *  @example:
 *    // Encoding binary data as a hexstring
 *    encodeBase64("0x1234")
 *    //_result:
 *
 *    // Encoding binary data as a Uint8Array
 *    encodeBase64(new Uint8Array([ 0x12, 0x34 ]))
 *    //_result:
 *
 *    // The input MUST be data...
 *    encodeBase64("Hello World!!")
 *    //_error:
 *
 *    // ...use toUtf8Bytes for this.
 *    encodeBase64(toUtf8Bytes("Hello World!!"))
 *    //_result:
 */
export function encodeBase64(data: string | Uint8Array): string {
  return Buffer.from(getBytes(data)).toString('base64')
}
