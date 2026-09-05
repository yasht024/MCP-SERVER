export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RATE_LIMITED = 'RATE_LIMITED',
  CONFLICT_OR_DUPLICATE = 'CONFLICT_OR_DUPLICATE',
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class McpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'McpError';
  }

  toJSON() {
    return {
      status: 'error',
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
      },
    };
  }
}

export function handleGoogleApiError(error: any): McpError {
  const status = error?.response?.status;
  const data = error?.response?.data;
  
  if (status === 401) {
    return new McpError(ErrorCode.AUTHENTICATION_REQUIRED, 'Authentication required or token expired.', false, error);
  } else if (status === 403) {
    if (data?.error?.message?.includes('Rate Limit') || data?.error?.message?.includes('quota')) {
      return new McpError(ErrorCode.RATE_LIMITED, 'Google API rate limit exceeded.', true, error);
    }
    return new McpError(ErrorCode.PERMISSION_DENIED, 'Permission denied by Google API.', false, error);
  } else if (status === 404) {
    return new McpError(ErrorCode.RESOURCE_NOT_FOUND, 'Resource not found.', false, error);
  } else if (status >= 500) {
    return new McpError(ErrorCode.GOOGLE_API_ERROR, 'Google API encountered an internal error.', true, error);
  }
  
  return new McpError(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred.', false, error);
}
