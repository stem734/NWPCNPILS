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
};

export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const functionError = error as FunctionsHttpErrorLike;

  if (functionError?.context && typeof functionError.context.clone === 'function') {
    try {
      const response = functionError.context;
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
      return functionError.message || fallback;
    }
  }

  if (functionError instanceof Error && functionError.message.trim()) {
    return functionError.message;
  }

  return fallback;
}
