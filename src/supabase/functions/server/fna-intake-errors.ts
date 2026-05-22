/**
 * Typed errors for FNA intake routes — map to correct HTTP status codes.
 */

export class FnaIntakeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FnaIntakeError';
    this.status = status;
  }
}

export function intakeNotFound(message = 'Intake session not found'): FnaIntakeError {
  return new FnaIntakeError(message, 404);
}

export function intakeForbidden(message = 'Unauthorized access to client intake'): FnaIntakeError {
  return new FnaIntakeError(message, 403);
}

export function intakeConflict(message: string): FnaIntakeError {
  return new FnaIntakeError(message, 409);
}

export function intakeUnprocessable(message: string): FnaIntakeError {
  return new FnaIntakeError(message, 422);
}

export function intakeRateLimited(message = 'Too many requests. Please try again later.'): FnaIntakeError {
  return new FnaIntakeError(message, 429);
}
