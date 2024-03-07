#!/usr/bin/env node

import childProcess, { SpawnOptions } from 'node:child_process'
import path from 'node:path'

const { DOCKER, USE_UPSTREAM_BUNDLER } = process.env

const root = path.join(__dirname, '..', '..')

const docker = DOCKER || 'docker'
const bundler = USE_UPSTREAM_BUNDLER === '1' ? 'bundler-upstream' : 'bundler'

async function exec(command: string, args: string[], options: Omit<SpawnOptions, 'stdio'> = {}) {
  const process = childProcess.spawn(command, args, { ...options, stdio: 'inherit' })
  await new Promise((resolve, reject) => {
    process.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
      } else {
        reject(new Error(`'${command}' process exited with code ${code}`))
      }
    })
  })
}

async function checkRpc(...urls: string[]) {
  const statuses = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url)
        return response.ok
      } catch (err) {
        return false
      }
    }),
  )
  return statuses.every((ok) => ok)
}

async function main() {
  console.log('==> Starting docker containers...')
  await exec(docker, ['compose', 'up', '-d', 'geth', bundler], { cwd: root })

  console.log('==> Waiting for RPC endpoints')
  const start = Date.now()
  const timeout = 60 * 1000
  while (!(await checkRpc('http://localhost:8545', 'http://localhost:3000'))) {
    if (Date.now() - start > timeout) {
      throw new Error('timeout waiting for local node and bundler to start')
    }
  }

  try {
    console.log('==> Running tests')
    await exec('hardhat', ['test', '--network', 'localhost', '--grep', '@4337'])
  } finally {
    console.log('==> Shutting down')
    await exec(docker, ['compose', 'down'], { cwd: root })
  }
}

main().catch((err) => {
  console.error('ERROR: ', err)
  if (err.stderr) {
    console.log(err.stderr)
  }
  process.exitCode = 1
})
