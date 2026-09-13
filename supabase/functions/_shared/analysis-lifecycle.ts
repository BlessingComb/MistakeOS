export type CompletionResponse<T> = { data: T; error: unknown | null };

export class AnalysisFinalizationError extends Error {
  readonly code = 'PERSISTENCE_RETRYABLE';

  constructor() {
    super('PERSISTENCE_RETRYABLE');
    this.name = 'AnalysisFinalizationError';
  }
}

type LifecycleOptions<TProvider, TCompletion> = {
  runProvider: () => Promise<TProvider>;
  complete: (providerResult: TProvider) => Promise<CompletionResponse<TCompletion>>;
  onProviderFailure: (error: unknown) => Promise<void>;
  maxCompletionAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export async function runAnalysisLifecycle<TProvider, TCompletion>({
  runProvider,
  complete,
  onProviderFailure,
  maxCompletionAttempts = 3,
  sleep = delay,
}: LifecycleOptions<TProvider, TCompletion>): Promise<TCompletion> {
  let providerResult: TProvider;
  try {
    providerResult = await runProvider();
  } catch (error) {
    try {
      await onProviderFailure(error);
    } catch {
      // The provider error remains the authoritative outcome even if recording
      // that failure is temporarily unavailable.
    }
    throw error;
  }

  const attempts = Math.max(1, Math.min(maxCompletionAttempts, 3));
  for (let index = 0; index < attempts; index += 1) {
    try {
      const result = await complete(providerResult);
      if (!result.error) return result.data;
    } catch {
      // Retry the exact same immutable completion payload below.
    }
    if (index + 1 < attempts) await sleep(75 * 2 ** index);
  }

  // Residual limitation: the external provider call and PostgreSQL cannot be
  // exactly-once without durable orchestration. A process crash after the
  // provider response but before any successful completion can lose this
  // in-memory payload; a later logical retry may call the provider again.
  throw new AnalysisFinalizationError();
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
