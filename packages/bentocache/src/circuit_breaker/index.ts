import { InvalidArgumentsException } from '@poppinss/utils/exceptions'

const CircuitBreakerState = { Closed: 0, Open: 1 }

interface CircuitBreakerOptions {
  /**
   * In milliseconds, how long the circuit breaker should stay open
   */
  breakDuration: number | undefined
}

/**
 * Super simple circuit breaker implementation
 */
export class CircuitBreaker {
  #state = CircuitBreakerState.Closed
  #willCloseAt: number | null = null
  #breakDuration: number

  constructor(options: CircuitBreakerOptions) {
    this.#breakDuration = options.breakDuration ?? 0
    if (this.#breakDuration < 0) {
      throw new InvalidArgumentsException('breakDuration must be a positive number')
    }

    this.#state = CircuitBreakerState.Closed
  }

  /**
   * Check if the circuit breaker should change state
   */
  #checkState() {
    if (this.#willCloseAt && this.#willCloseAt < Date.now()) this.close()
  }

  /**
   * Check if the circuit breaker is open
   */
  isOpen() {
    this.#checkState()
    return this.#state === CircuitBreakerState.Open
  }

  /**
   * Check if the circuit breaker is closed
   */
  isClosed() {
    this.#checkState()
    return this.#state === CircuitBreakerState.Closed
  }

  /**
   * Open the circuit breaker
   */
  open() {
    if (this.#state === CircuitBreakerState.Open) return

    this.#state = CircuitBreakerState.Open
    this.#willCloseAt = Date.now() + this.#breakDuration
  }

  /**
   * Close the circuit breaker
   */
  close() {
    this.#state = CircuitBreakerState.Closed
    this.#willCloseAt = null
  }
}
