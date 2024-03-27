declare module 'solc' {
  export type Compiler = {
    compile: (input: string) => string
  }

  export function compile(input: string): string

  export function loadRemoteVersion(version: string, callback: (err: Error, solc: Compiler) => void): void
}
