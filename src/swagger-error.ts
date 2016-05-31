export class SwaggerError extends Error {
  public httpCode: string;
  public errorCode: string;
  public errorMessage: string;
  public stack: any;
  public details: any;

  constructor(httpCode, errorCode, errorMessage, details) {
    super(errorMessage);
    this.httpCode = httpCode;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.stack = (new Error()).stack;
    this.details = details;
  }
  toJSON() {
    return {
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      details: this.details
    }
  }
}