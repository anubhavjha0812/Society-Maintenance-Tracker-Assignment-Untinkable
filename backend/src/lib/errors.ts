export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: (message = "Unauthorized") => new AppError(401, "unauthorized", message),
  forbidden: (message = "Forbidden") => new AppError(403, "forbidden", message),
  notFound: (message = "Not found") => new AppError(404, "not_found", message),
  badRequest: (message = "Bad request") => new AppError(400, "bad_request", message),
  conflict: (message = "Conflict") => new AppError(409, "conflict", message),
};
