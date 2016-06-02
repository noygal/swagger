export declare class SwaggerError extends Error {
    httpCode: any;
    errorCode: any;
    errorMessage: any;
    stack: any;
    details: any;
    constructor(httpCode: any, errorMessage: any, errorCode?: any, details?: any);
    toJSON(): {
        httpCode: any;
        errorCode: any;
        errorMessage: any;
        details: any;
    };
}
