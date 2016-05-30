let swaggerClient = Npm.require('swagger-client');

class SwaggerClient {
  constructor(name, swaggerDefinition, options = {debug: false, logger: console}) {
    this.promise = new Promise((resolve) => {
      this.api = new swaggerClient({
        spec: swaggerDefinition,
        success: () => {
          _.forEach(api.apisArray, (currentApi) => {
            let controller = api[currentApi.name];

            _.forEach(controller.apis, (operationMetadata, operationKey) => {
              let operation = controller[operationKey];

              controller[operationKey] = function (...args) {
                if (args.length === 0) {
                  args = [{}];
                }

                if (options.debug) {
                  options.logger.log('debug', "About to run operation " + operationKey + ' with transformed arguments: ', args);
                }

                return new Promise((resolve, reject) => {
                  operation.apply(this, args.concat(resolve, reject));
                });
              }
            })
          });

          resolve(api);
        }
      });
    });
  }
  
  ready() {
    return this.promise;
  }
  
  api() {
    return this.api;
  }
}