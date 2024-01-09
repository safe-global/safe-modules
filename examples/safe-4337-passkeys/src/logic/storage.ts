/**
 * Sets an item in the local storage.
 * @param key - The key to set the item with.
 * @param value - The value to be stored.
 * @template T - The type of the value being stored.
 */
function setItem<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

/**
 * Retrieves the value associated with the specified key from the local storage.
 *
 * @param key - The key of the item to retrieve.
 * @returns The value associated with the key, or null if the key does not exist.
 */
function getItem(key: string): string | null {
  const item = localStorage.getItem(key)
  if (!item) return null
  return JSON.parse(item)
}

export { setItem, getItem }
