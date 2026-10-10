/**
 * A minimal chainable mock for the Supabase JS query builder, for services
 * that call `.from(table).select(...).eq(...).single()` etc. with different
 * shapes per call. Queue up responses with `mockNextResponse()` in the order
 * your code under test will consume them (each terminal call — `.single()`,
 * `.maybeSingle()`, or awaiting the builder directly for a plain
 * `.insert()`/`.update()` — pops the next queued response).
 */
export interface ChainResponse {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export function createSupabaseChainMock() {
  const queue: ChainResponse[] = [];
  const calls: { table: string; method: string; args: unknown[] }[] = [];

  function nextResponse(): ChainResponse {
    const next = queue.shift();
    return next ?? { data: null, error: null };
  }

  function makeBuilder(table: string) {
    const builder: any = {};
    const chainMethods = ['select', 'eq', 'order', 'limit', 'in', 'gte', 'lte', 'insert', 'update', 'delete'];
    for (const method of chainMethods) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder.single = async () => nextResponse();
    builder.maybeSingle = async () => nextResponse();
    // Awaiting the builder itself (no .single()/.maybeSingle()) — used after
    // a plain .insert()/.update() with no terminal selector.
    builder.then = (resolve: (v: ChainResponse) => void) => resolve(nextResponse());
    return builder;
  }

  const supabase = {
    from: (table: string) => makeBuilder(table),
    channel: () => ({ send: async () => undefined }),
  };

  return {
    supabase,
    /** Queue the response the next terminal call (.single/.maybeSingle/await) will resolve to. */
    mockNextResponse: (response: ChainResponse) => queue.push(response),
    calls,
  };
}
