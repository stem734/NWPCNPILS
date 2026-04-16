type ErrorPayload = {
  error?: string;
  message?: string;
};

type ResponseLike = {
  headers: {
    get(name: string): string | null;
  };
  clone(): {
    json(): Promise<unknown>;
    text(): Promise<string>;
  };
};

type FunctionsHttpErrorLike = Error & {
  context?: ResponseLike;
  name?: string;
};

function hasResponseContext(value: unknown): value is FunctionsHttpErrorLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as FunctionsHttpErrorLike;
  return Boolean(candidate.context && typeof candidate.context.clone === 'function');
}

export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const functionError = error as FunctionsHttpErrorLike | undefined;

  if (hasResponseContext(error)) {
    try {
      const response = error.context;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const body = await response.clone().json() as ErrorPayload;
        if (typeof body.error === 'string' && body.error.trim()) {
          return body.error;
        }
        if (typeof body.message === 'string' && body.message.trim()) {
          return body.message;
        }
      }

      const text = await response.clone().text();
      if (text.trim()) {
        return text;
      }
    } catch {
      return error.message || fallback;
    }
  }

  if (functionError?.message && functionError.message.trim()) {
    return functionError.message;
  }

  return fallback;
}
