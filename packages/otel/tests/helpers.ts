import { memoryDriver } from 'bentocache/drivers/memory'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'

import { BentoCacheInstrumentation } from '../src/instrumentation.js'

/**
 * Controls how bentocache instrumentation is attached during tests.
 */
export type SetupMode = 'modulePatch' | 'manualRegister'

/**
 * Signature used by Japa to register test cleanup callbacks.
 */
type CleanupFn = (callback: () => Promise<void> | void) => void

/**
 * Reused tracer setup shared across tests.
 */
let tracerSetup: { exporter: InMemorySpanExporter; provider: BasicTracerProvider } | undefined

/**
 * Creates a singleton tracer provider and in-memory exporter for the suite.
 * Existing exporters are reset between tests to isolate assertions.
 */
const setupTracer = () => {
  if (tracerSetup) {
    tracerSetup.exporter.reset()
    return tracerSetup
  }

  const exporter = new InMemorySpanExporter()
  const provider = new BasicTracerProvider()

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
  provider.register()

  tracerSetup = { exporter, provider }
  return tracerSetup
}

/**
 * Boots instrumentation for a test and returns all runtime handles.
 * Supports both automatic module patching and manual registration mode.
 */
export const setupInstrumentation = async (
  cleanup: CleanupFn,
  config: ConstructorParameters<typeof BentoCacheInstrumentation>[0] = {},
  mode: SetupMode = 'modulePatch',
) => {
  const { exporter, provider } = setupTracer()
  void provider

  const instrumentation = new BentoCacheInstrumentation(config)
  const moduleDefinitions = (instrumentation as any)._modules as any[]
  const moduleDefinition = moduleDefinitions[0]

  const bentocacheModule = await import('bentocache')

  if (mode === 'modulePatch') {
    moduleDefinition.patch?.(bentocacheModule)
    instrumentation.enable()
  } else {
    const moduleExports = (bentocacheModule as any).default ?? bentocacheModule
    instrumentation.enable()
    instrumentation.manuallyRegister(moduleExports)
  }

  cleanup(async () => {
    instrumentation.disable()
  })

  return { exporter, instrumentation, bentocacheModule }
}

/**
 * Builds a minimal in-memory BentoCache store used by instrumentation tests.
 */
export const createMemoryStore = (bentocacheModule: any) => {
  const cache = new bentocacheModule.BentoCache({
    default: 'memory',
    stores: {
      memory: bentocacheModule.bentostore().useL1Layer(memoryDriver({})),
    },
  })

  return cache.use('memory')
}
