/*
|--------------------------------------------------------------------------
| Script to download sponsors
|--------------------------------------------------------------------------
|
| This script downloads the sponsors JSON from the pre-configured URLs
| configured inside the "content/config.json" file.
|
*/

import { request } from 'undici'
import { readFile, writeFile } from 'node:fs/promises'

/**
 * The file path to the config.json file
 */
const CONFIG_FILE_PATH = new URL('../content/config.json', import.meta.url)

/**
 * The file path to the sponsors.json file. The output will be written
 * here.
 */
const SPONSORS_FILE_PATH = new URL('../content/sponsors.json', import.meta.url)

export async function downloadSponsors() {
  console.log('starting to download sponsors...')

  try {
    const fileContents = await readFile(CONFIG_FILE_PATH, 'utf-8')
    const sources = JSON.parse(fileContents).sponsors_sources
    let sponsorsList: any[] = []

    /**
     * No sources configured. So going to create an empty
     * sponsors.json file.
     */
    if (sources.length === 0) {
      console.log('skipping download. No sources found...')
      await writeFile(SPONSORS_FILE_PATH, JSON.stringify(sponsorsList))
      return
    }

    /**
     * Processing sponsors
     */
    for (const source of sources) {
      const { body } = await request(source)
      const sponsors = (await body.json()) as any[]
      sponsorsList = sponsorsList.concat(sponsors)
      console.log(`Downloaded "${sponsors.length} sponsors" from "${source}"`)
    }

    await writeFile(SPONSORS_FILE_PATH, JSON.stringify(sponsorsList))
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('Cannot download sponsors list. Unable to find "content/config.json" file')
      return
    }

    console.error(error)
  }
}

await downloadSponsors()
