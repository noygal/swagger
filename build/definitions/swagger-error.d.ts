export declare class SwaggerError extends Error {
    httpCode: string;
    errorCode: string;
    errorMessage: string;
    stack: any;
    details: any;
    constructor(httpCode: any, errorMessage: any, errorCode: any, details?: any);
    toJSON(): {
        errorCode: string;
        errorMessage: string;
        details: any;
    };
}
