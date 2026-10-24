/** Errors whose message is safe to show to the customer or the administrator. */
export class AppError extends Error {
  readonly status: number = 400;
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  override readonly status = 422;
}

export class NotFoundError extends AppError {
  override readonly status = 404;
}

export class ConflictError extends AppError {
  override readonly status = 409;
}

export class RateLimitError extends AppError {
  override readonly status = 429;
}

export class UnauthenticatedError extends AppError {
  override readonly status = 401;
}
