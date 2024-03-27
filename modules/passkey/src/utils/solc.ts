import solc from 'solc'
import type { Compiler } from 'solc'

const solcCache: Record<string, Compiler> = {}

export const loadSolc = async (version: string): Promise<Compiler> => {
  return await new Promise((resolve, reject) => {
    if (solcCache[version] !== undefined) resolve(solcCache[version])
    else
      solc.loadRemoteVersion(`v${version}`, (error, solcjs) => {
        solcCache[version] = solcjs
        return error ? reject(error) : resolve(solcjs)
      })
  })
}
