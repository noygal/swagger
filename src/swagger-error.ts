export class SwaggerError extends Error {
  public httpCode: string;
  public errorCode: string;
  public errorMessage: string;
  public stack: any;
  public details: any;

  constructor(httpCode, errorMessage, errorCode, details?) {
    super(errorMessage);
    this.httpCode = httpCode;
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
    this.details = details;
    this.stack = (new Error()).stack;
  }
  toJSON() {
    return {
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      details: this.details
    }
  }
}