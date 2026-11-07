/** An error the API sends to the app as `{ error: { code, message } }` with this HTTP status. */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The value if it's a string of at most `max` characters, otherwise ''. */
export const str = (v, max = 200) => (typeof v === 'string' && v.length <= max ? v : '');

export const notFound = (what) => new ApiError(404, 'not_found', `${what} not found.`);
export const forbidden = (message = 'You don’t have permission to do this.') => new ApiError(403, 'forbidden', message);
export const invalid = (message) => new ApiError(400, 'invalid', message);
