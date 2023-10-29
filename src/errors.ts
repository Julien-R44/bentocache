import { createError } from '@poppinss/utils'

export const E_FACTORY_SOFT_TIMEOUT = createError(
  'Factory has timed out after waiting for soft timeout',
  'E_FACTORY_SOFT_TIMEOUT'
)

export const E_FACTORY_HARD_TIMEOUT = createError(
  'Factory has timed out after waiting for hard timeout',
  'E_FACTORY_HARD_TIMEOUT'
)
