import type { ErrorCode } from '@gachanime/shared'

/** A business error with a stable code; the API layer maps it to an HTTP response. */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly details: unknown

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}
