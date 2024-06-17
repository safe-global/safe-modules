import solc from 'solc'

const solcCache: Record<string, Compiler> = {}

export interface Compiler {
  compile: (input: string) => string
}

export const loadSolc = async (version: string): Promise<Compiler> => {
  return await new Promise((resolve, reject) => {
    if (solcCache[version] !== undefined) resolve(solcCache[version])
    else
      solc.loadRemoteVersion(`v${version}`, (error: unknown, solcjs: Compiler) => {
        solcCache[version] = solcjs
        return error ? reject(error) : resolve(solcjs)
      })
  })
}
