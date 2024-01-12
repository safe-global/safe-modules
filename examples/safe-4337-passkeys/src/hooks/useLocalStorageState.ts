import { useEffect, useState } from 'react'
import { setItem, getItem } from '../logic/storage.ts'

/**
 * Custom hook that manages state in local storage.
 *
 * @template T - The type of the state value.
 * @param {string} key - The key used to store the state value in local storage.
 * @param {T} initialValue - The initial value of the state.
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]} - An array containing the current state value and a function to update the state.
 */
function useLocalStorageState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const storedValue = getItem(key)

    if (storedValue) {
      try {
        return JSON.parse(storedValue) as T
      } catch {
        // trick eslint with a no-op
      }
    }

    return initialValue
  })

  useEffect(() => {
    setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState]
}

export { useLocalStorageState }
