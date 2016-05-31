export declare const SwaggerServer: {
    debug: boolean;
    raw: boolean;
    cors: boolean;
    handlers: any[];
    registeredControllers: Map<{}, {}>;
    registeredOperations: Map<{}, {}>;
    registeredParamters: Map<{}, {}>;
    instances: Map<{}, {}>;
    argumentsTransforms: Map<{}, {}>;
    definitions: Map<{}, {}>;
    logger: Console;
    errorHandler: any;
    externalConnectMiddlewares: any[];
    addConnectMiddleware(middlewareFn: any): void;
    setErrorHandler(errHandler: any): void;
    setLogger(logger: any): void;
    allowCors(origin: any): void;
    loadServerDefinition(identifier: any, swaggerDefinition?: any): void;
    Controller(name: any): (target: any) => void;
    Operation(operationId: any): (target: any, name: any) => void;
    Parameter(parameterName: any): (target: any, name: any, argIndex: any) => void;
    Transform(...transformers: any[]): (target: any, name: any, argIndex: any) => void;
    bind(constructor: any, instance: any): void;
    registerHandler(controller: any, operationId: any, context: any, cb: any, transformers: any, namedParameters: any): void;
    useStubs(useStubs: any): void;
    debugMode(debugMode: any): void;
    printRaw(isRaw: any): void;
    start(): void;
    allowDocs(): void;
};
export declare function writeJsonToBody(res: any, json: any): void;
export declare function defaultErrorHandler(err: any, req: any, res: any, next: any): void;