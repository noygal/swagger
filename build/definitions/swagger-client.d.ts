export interface SwaggerResponse<R> {
    obj: R;
}
export interface SwaggerClientApi {
    apis: any;
    apisArray: any;
    basePath: any;
    consumes: any;
    host: any;
    info: any;
    produces: any;
    schemes: any;
    securityDefinitions: any;
    security: any;
    title: any;
    setHost(host: string): void;
    setSchemes(arr: Array<string>): void;
    setBasePath(basePath: string): void;
    clientAuthorizations: {
        add(securityDefinitionName: string, value: any): void;
    };
}
export declare class SwaggerClient<T extends SwaggerClientApi> {
    private name;
    private promise;
    private _api;
    constructor(name: any, swaggerDefinition: any, options?: {
        debug: boolean;
        logger: Console;
    });
    ready(): Promise<T>;
    api(): T;
}
