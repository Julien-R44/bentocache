// @ts-check

import { join } from 'node:path'
import { readdir, unlink, readFile } from 'node:fs/promises'

/**
 * Read the file content and delete it if it's expired
 * @param {object} options
 * @param {string} options.filePath
 * @param {(err: { filePath: string, error: any }) => void} [options.onError]
 */
async function deleteFileIfExpired({ filePath, onError }) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const [, expiresAt] = JSON.parse(content)

    const expiry = new Date(expiresAt).getTime()
    if (+expiry === -1) return

    if (expiry < Date.now()) await unlink(filePath)
  } catch (error) {
    if (onError) onError({ filePath, error })
  }
}

/**
 * Get recursive list of files in the cache directory and delete expired files
 * @param {object} options
 * @param {string} options.directory
 * @param {(err: { filePath: string, error: any }) => void} [options.onError]
 */
export async function pruneExpiredFiles({ directory, onError }) {
  const dirEntries = await readdir(directory, { recursive: true, withFileTypes: true })

  for (const dirEntry of dirEntries) {
    if (dirEntry.isDirectory()) continue

    const filePath = join(dirEntry.parentPath, dirEntry.name)
    await deleteFileIfExpired({ filePath, onError })
  }
}
