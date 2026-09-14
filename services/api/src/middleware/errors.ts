import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required to access this resource') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions to perform this action') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds: number;

  constructor(message: string = 'Too many requests, please try again later', retryAfterSeconds: number = 60) {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || 'unknown';

  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds));
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      type: `https://aegispulse.internal/errors/${err.code}`,
      title: err.name.replace(/Error$/, ''),
      status: err.statusCode,
      detail: err.message,
      instance: req.originalUrl,
      code: err.code,
      requestId,
      details: err.details,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unhandled errors
  console.error(`[${requestId}] Unhandled Error:`, err);
  res.status(500).json({
    type: 'https://aegispulse.internal/errors/INTERNAL_ERROR',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected internal error occurred.',
    instance: req.originalUrl,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
  });
}
