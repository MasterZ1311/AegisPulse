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

export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Upstream operation or request timed out') {
    super(message, 504, 'GATEWAY_TIMEOUT');
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || req.correlationId || 'unknown';

  if (err instanceof RateLimitError) {
    res.setHeader('Retry-After', String(err.retryAfterSeconds));
  }

  // 1. Known AppError instances
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

  // 2. Express JSON body parser SyntaxError
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      type: 'https://aegispulse.internal/errors/MALFORMED_JSON',
      title: 'Malformed JSON',
      status: 400,
      detail: 'The request body could not be parsed as valid JSON.',
      instance: req.originalUrl,
      code: 'MALFORMED_JSON',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 2.1 Express JSON body parser Payload Too Large
  if (err.status === 413 || err.statusCode === 413 || (err as any).type === 'entity.too.large') {
    res.status(413).json({
      type: 'https://aegispulse.internal/errors/PAYLOAD_TOO_LARGE',
      title: 'Payload Too Large',
      status: 413,
      detail: 'The request body exceeds the maximum permitted size limit of 1MB.',
      instance: req.originalUrl,
      code: 'PAYLOAD_TOO_LARGE',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 3. SQLite Database Constraint / Busy / Availability Errors
  const errMsg = String(err?.message || '');
  if (errMsg.includes('UNIQUE constraint failed')) {
    res.status(409).json({
      type: 'https://aegispulse.internal/errors/DUPLICATE_ENTITY',
      title: 'Duplicate Entity',
      status: 409,
      detail: 'A record with the specified identifier or unique attributes already exists.',
      instance: req.originalUrl,
      code: 'DUPLICATE_ENTITY',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (errMsg.includes('CHECK constraint failed')) {
    res.status(400).json({
      type: 'https://aegispulse.internal/errors/CONSTRAINT_VIOLATION',
      title: 'Database Constraint Violation',
      status: 400,
      detail: errMsg,
      instance: req.originalUrl,
      code: 'CONSTRAINT_VIOLATION',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (
    errMsg.includes('busy') ||
    errMsg.includes('locked') ||
    errMsg.includes('database is closed') ||
    errMsg.includes('not open') ||
    errMsg.includes('database connection is closed')
  ) {
    res.status(503).json({
      type: 'https://aegispulse.internal/errors/DATABASE_BUSY',
      title: 'Database Unavailable',
      status: 503,
      detail: 'The database is currently busy or unavailable. Please retry.',
      instance: req.originalUrl,
      code: 'DATABASE_UNAVAILABLE',
      requestId,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 4. Unhandled errors
  console.error(`[${requestId}] Unhandled Error:`, err);
  res.status(500).json({
    type: 'https://aegispulse.internal/errors/INTERNAL_ERROR',
    title: 'Internal Server Error',
    status: 500,
    detail: process.env.NODE_ENV === 'production' ? 'An unexpected internal error occurred.' : (err?.message || 'An unexpected internal error occurred.'),
    instance: req.originalUrl,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
  });
}

