export class SwaggerError extends Error {
  public httpCode: any;
  public errorCode: any;
  public errorMessage: any;
  public stack: any;
  public details: any;

  constructor(httpCode: number, errorMessage: string, errorCode?: any, details?: any) {
    super(errorMessage);
    this.httpCode = httpCode;
    this.errorMessage = errorMessage;
    this.errorCode = errorCode;
    this.details = details;
  }

  static from(errObj : any) : SwaggerError {
     return new SwaggerError(errObj.httpCode || 500, errObj.errorMessage || "Error", errObj.errorCode || 0, errObj.details || {});
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
