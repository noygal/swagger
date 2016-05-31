let swaggerClient = Npm.require('swagger-client');
declare var _;
const {forEach} = _;

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

  setHost(host:string): void;
  setSchemes(arr : Array<string>): void;
  setBasePath(basePath: string) : void;
  clientAuthorizations: {
    add(securityDefinitionName : string, value : any) : void;
  }
}

export class SwaggerClient<T extends SwaggerClientApi> {
  private name: string;
  private promise: Promise<T>;
  private _api: T;
  
  constructor(name, options = {debug: false, logger: console}, swaggerDefinition = null) {
    if(!swaggerDefinition) {
      let SwaggerConfig = global.SwaggerConfig;
      if(!SwaggerConfig) {
        throw `Cannot initialize SwaggerClient for ${name} because no SwaggerConfig global was found.`
      } else if (!SwaggerConfig[name]) {
        throw `Cannot initialize SwaggerClient for ${name} because no swagger-definition was provided and`
      }

      swaggerDefinition = SwaggerConfig[name];
    }

    this.name = name;
    this.promise = new Promise((resolve) => {
      this._api = <T> new swaggerClient({
        spec: swaggerDefinition,
        success: () => {
          forEach(this._api.apisArray, (currentApi) => {
            let controller = this._api[currentApi.name];

            forEach(controller.apis, (operationMetadata, operationKey) => {
              let operation = controller[operationKey];

              controller[operationKey] = function (...args) {
                if (args.length === 0) {
                  args = [{}];
                }

                if (options.debug) {
                  options.logger.log('debug', `## SwaggerClient(${this.name}) ## About to run operation " + operationKey + ' with transformed arguments: `, args);
                }

                return new Promise((resolve, reject) => {
                  operation.apply(this, args.concat(resolve, reject));
                });
              }
            })
          });

          resolve(this._api);
        }
      });
    });
  }
  
  ready(): Promise<T> {
    return this.promise;
  }
  
  api(): T {
    return this._api;
  }
}