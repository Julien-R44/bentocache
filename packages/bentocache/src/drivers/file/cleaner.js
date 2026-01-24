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
    /**
     * If the file is empty or contains invalid JSON, we should delete it
     * as its a corrupted cache file that wont be readable anyway
     */
    if (error instanceof SyntaxError) {
      if (onError) onError({ filePath, error })
      await unlink(filePath).catch(() => {})
      return
    }

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

    /**
     * "parentPath" was added in Node.js v20.12.0.
     * We fallback to "path" for older versions of Node.js.
     */
    // @ts-expect-error -- ignore --
    const basePath = typeof dirEntry.parentPath === 'string' ? dirEntry.parentPath : dirEntry.path

    const filePath = join(basePath, dirEntry.name)
    await deleteFileIfExpired({ filePath, onError })
  }
}
