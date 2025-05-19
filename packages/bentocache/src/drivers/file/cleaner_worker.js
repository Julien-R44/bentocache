// @ts-check

import { join } from 'node:path'
import { readdir, unlink, readFile } from 'node:fs/promises'
import { parentPort, workerData } from 'node:worker_threads'

const directory = workerData.directory
const pruneIntervalInMs = workerData.pruneInterval

/**
 * Read the file content and delete it if it's expired
 *
 * @param {string} filePath
 */
async function deleteFileIfExpired(filePath) {
  const content = await readFile(filePath, 'utf-8')
  const [, expiresAt] = JSON.parse(content)

  const expiry = new Date(expiresAt).getTime()
  if (+expiry === -1) return

  if (expiry < Date.now()) {
    await unlink(filePath)
  }
}

/**
 * Get recursive list of files in the cache directory and delete expired files
 */
async function prune() {
  const dirEntries = await readdir(directory, { recursive: true, withFileTypes: true })

  for (const dirEntry of dirEntries) {
    if (dirEntry.isDirectory()) continue

    const filePath = join(dirEntry.path, dirEntry.name)
    await deleteFileIfExpired(filePath).catch((error) => {
      parentPort?.postMessage({ type: 'error', error })
    })
  }
}

setInterval(async () => {
  try {
    await prune()
    parentPort?.postMessage({ type: 'info', message: 'cache cleaned up' })
  } catch (error) {
    parentPort?.postMessage({ type: 'error', error })
  }
}, pruneIntervalInMs)
