import { assert } from '@japa/assert'
import { fileSystem } from '@japa/file-system'
import { expectTypeOf } from '@japa/expect-type'
import { processCLIArgs, configure, run } from '@japa/runner'

import 'dotenv/config'
import { BASE_URL } from '../test_helpers/index.js'

/*
|--------------------------------------------------------------------------
| Configure tests
|--------------------------------------------------------------------------
|
| The configure method accepts the configuration to configure the Japa
| tests runner.
|
| The first method call "processCLIArgs" process the command line arguments
| and turns them into a config object. Using this method is not mandatory.
|
| Please consult japa.dev/runner-config for the config docs.
*/
processCLIArgs(process.argv.slice(2))
configure({
  suites: [
    {
      name: 'drivers',
      files: ['tests/drivers/**/*.spec.ts'],
    },
    {
      name: 'unit',
      files: ['tests/**/*.spec.ts', '!tests/drivers/**/*.spec.ts'],
    },
  ],
  plugins: [assert(), expectTypeOf(), fileSystem({ autoClean: true, basePath: BASE_URL })],
})

/*
|--------------------------------------------------------------------------
| Run tests
|--------------------------------------------------------------------------
|
| The following "run" method is required to execute all the tests.
|
*/
run()
