// @ts-check

import { parentPort, workerData } from 'node:worker_threads'

import { pruneExpiredFiles } from './cleaner.js'

const directory = workerData.directory
const pruneIntervalInMs = workerData.pruneInterval

/**
 * Get recursive list of files in the cache directory and delete expired files
 */
async function prune() {
  await pruneExpiredFiles({
    directory,
    onError: (err) => parentPort?.postMessage({ type: 'error', error: err }),
  })
}

setInterval(async () => {
  try {
    await prune()
    parentPort?.postMessage({ type: 'info', message: 'cache cleaned up' })
  } catch (error) {
    parentPort?.postMessage({ type: 'error', error })
  }
}, pruneIntervalInMs)
