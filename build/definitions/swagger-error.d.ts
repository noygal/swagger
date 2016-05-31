export declare class SwaggerError extends Error {
    constructor(httpCode: any, errorCode: any, errorMessage: any, details: any);
    toJSON(): {
        errorCode: any;
        errorMessage: any;
        details: any;
    };
}
