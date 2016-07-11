export class SwaggerError extends Error {
  public httpCode: any;
  public errorCode: any;
  public errorMessage: any;
  public stack: any;
  public details: any;

  constructor(httpCode: number, errorMessage: string, errorCode?: any, details?: any) {
    super(errorMessage);
    console.log("Creating new SwaggerError with " + httpCode + " errorMessage: " + errorMessage);
    this.httpCode = httpCode;
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
    this.details = details;
  }
  
  toJSON() {
    return {
      httpCode: this.httpCode,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      details: this.details
    }
  }
}
