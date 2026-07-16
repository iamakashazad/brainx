export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message || `API request failed with status ${status}`);
    this.name = "ApiError";
  }
}
