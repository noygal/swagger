let swaggerTools = Npm.require('swagger-tools');
let swaggerClient = Npm.require('swagger-client');
let url = Npm.require('url');

function writeJsonToBody(res, json) {
  if (json !== undefined) {
    var shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    var spacer = shouldPrettyPrint ? 2 : null;
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(json, null, spacer));
  }
}

function isPromise(obj) {
  return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

function handleError(res, err, next) {
  if (err instanceof Swagger.Error) {
    res.statusCode = err.httpCode;
    writeJsonToBody(res, err.error);
    res.end();
  }
  else {
    console.log(err);
    next(err);
  }
}

function inDevelopment() {
  return process.env.NODE_ENV === "development";
}

ISwaggerRequestTransform = class ISwaggerRequestTransform {
  convertArguments(...args) {

  }
};

Swagger = {
  debug: false,
  handlers: [],
  registeredControllers: new Map(),
  controllerInstances: new Map(),
  transformers: new Map(),
  clients: new Map(),
  definitions: new Map(),

  Error: class Error {
    constructor(httpCode, error) {
      this.httpCode = httpCode;
      this.error = error;
    }
  },

  loadSwaggerDefinition (identifier, definition) {
    let parsedUrl = url.parse(Meteor.absoluteUrl());
    definition.host = `${parsedUrl.host}`;
    this.definitions.set(identifier, definition);
  },

  Controller (name) {
    return function (target) {
      target.controllerName = name;

      Swagger.registeredControllers.get(target).forEach((operation) => {
        let currentOperationTransformers = [];

        if (Swagger.transformers.get(target)) {
          Swagger.transformers.get(target).forEach((transformer) => {
            if (transformer.targetOperation === operation.cb) {
              currentOperationTransformers.push(transformer.implementation);
            }
          });
        }

        Swagger.registerHandler(target, operation.operationId, undefined, operation.cb, currentOperationTransformers);
      });
    }
  },

  RequestTransform(transformer) {
    return function (target, name) {
      if (transformer.prototype instanceof ISwaggerRequestTransform) {
        let transformers = Swagger.transformers.get(target.constructor);

        if (!transformers) {
          transformers = [];
          Swagger.transformers.set(target.constructor, transformers);
        }

        transformers.push({
          implementation: transformer,
          targetOperation: target[name]
        });
      }
      else {
        throw 'RequestTransform class must inherit and implement ISwaggerRequestTransform!';
      }
    }
  },

  Operation (operationId) {
    return function (target, name) {
      let controllerOperations = Swagger.registeredControllers.get(target.constructor);
      if (!controllerOperations) {
        controllerOperations = [];
        Swagger.registeredControllers.set(target.constructor, controllerOperations);
      }

      controllerOperations.push({
        operationId,
        cb: target[name]
      });
    }
  },

  bind (constructor, instance) {
    this.controllerInstances.set(constructor, instance);
  },

  registerHandler (controller, operationId, context, cb, transformers) {
    this.handlers.push({
      controller,
      operationId,
      context,
      cb,
      transformers: (transformers || []).reverse()
    });
  },

  useStubs (useStubs) {
    this.stubs = useStubs;
  },

  start (injector) {
    injector = injector || {
        get: function () {
        }
      };
    let controllers = {};

    this.handlers.forEach(({controller, operationId, context, cb, transformers}) => {
      // TODO: Separate to private function and explain logic with links
      controllers[`${controller.controllerName}_${operationId}`] = Meteor.bindEnvironment(function routeToHandler(req, res, next) {
        let args = _.pluck(req.swagger.params, 'value');
        context = context || Swagger.controllerInstances.get(controller);

        try {
          if (transformers.length > 0) {
            transformers.forEach((transformer) => {
              let instance = injector.get(transformer) || new transformer();
              let newArgs = instance.convertArguments.apply(instance, args) || [];

              newArgs.forEach((argValue, index) => {
                if (argValue !== undefined) {
                  args[index] = argValue;
                }
              });
            });
          }

          let returnValue = cb.apply(context, args);
          if (isPromise(returnValue)) {
            returnValue.then((result) => {
                writeJsonToBody(res, result);
                res.end();
              })
              .catch((err) => {
                handleError(res, err, next);
              })
          }
          else {
            writeJsonToBody(res, returnValue);
            res.end();
          }
        }
        catch (error) {
          handleError(res, error, next);
        }
      });
    });

    if (inDevelopment() || this._allowDocs) {
      WebApp.connectHandlers.use((req, res, next) => {
        if (req.url === '/docs' || req.url === '/docs/') {
          res.setHeader('content-type', 'text/html');
          let response = '<h2>All Swagger APIs</h2><ul>';
          this.definitions.forEach((definition, identifier) => {
            response += `<li>
                          <a href="/${identifier}/docs">
                            <h4>${definition.info.title}<h4>
                          </a>
                        </li>`;
          });
          res.write(response);
          res.end();
        }
        else {
          next();
        }
      });
    }

    this.definitions.forEach((definition, identifier) => {
      swaggerTools.initializeMiddleware(definition, (middleware) => {
        WebApp.connectHandlers.use(middleware.swaggerMetadata());
        WebApp.connectHandlers.use(middleware.swaggerValidator());
        WebApp.connectHandlers.use(middleware.swaggerRouter({
          controllers,
          useStubs: this.stubs
        }));

        if (inDevelopment() || this._allowDocs) {
          WebApp.connectHandlers.use(middleware.swaggerUi({
            swaggerUi: `/${identifier}/docs`,
            apiDocs: `/${identifier}/api-docs`
          }));
        }
      });
    });
  },

  createClient(name, swaggerDoc) {
    let promise = new Promise((resolve) => {
      let api = new swaggerClient({
        spec: swaggerDoc,
        success: () => {
          _.forEach(api.apisArray, (currentApi) => {
            let controller = api[currentApi.name];

            _.forEach(controller.apis, (operationMetadata, operationKey) => {
              let operation = controller[operationKey];

              controller[operationKey] = function(...args) {
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

    this.clients.set(name, promise);
  },

  client(name) {
    return this.clients.get(name);
  },

  allowDocs() {
    this._allowDocs = true;
  }
};
