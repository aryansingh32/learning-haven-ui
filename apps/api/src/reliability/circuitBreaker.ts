type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly options = {
      failureThreshold: 5,
      resetAfterMs: 30_000,
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.options.resetAfterMs) {
        throw new Error(`Circuit breaker open: ${this.name}`);
      }
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.options.failureThreshold) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}

export const circuitBreakers = {
  github: new CircuitBreaker('github'),
  openrouter: new CircuitBreaker('openrouter'),
  openai: new CircuitBreaker('openai'),
  anthropic: new CircuitBreaker('anthropic'),
  grok: new CircuitBreaker('grok'),
  email: new CircuitBreaker('email'),
  razorpay: new CircuitBreaker('razorpay'),
};
