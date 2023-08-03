/*
 * @adonisjs/cache
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Repl } from '@adonisjs/core/repl'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Define repl bindings. The method must be invoked when application environment
 * is set to repl.
 */
export function defineReplBindings(app: ApplicationService, repl: Repl) {
  repl.addMethod(
    'loadCache',
    async () => {
      repl.server!.context.cache = await app.container.make('cache')
      repl.notify(
        `Loaded "cache" service. You can access it using the "${repl.colors.underline(
          'cache'
        )}" variable`
      )
    },
    { description: 'Load "cache" service in the REPL context' }
  )
}
