export declare class SwaggerError extends Error {
    httpCode: any;
    errorCode: any;
    errorMessage: any;
    stack: any;
    details: any;
    constructor(httpCode: number, errorMessage: string, errorCode?: any, details?: any);
    static from(errObj: any): SwaggerError;
    toJSON(): {
        httpCode: any;
        errorCode: any;
        errorMessage: any;
        details: any;
    };
}
