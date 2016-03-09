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
    next(err);
  }
}

function inDevelopment() {
  return process.env.NODE_ENV === "development";
}

Swagger = {
  debug: false,
  handlers: [],
  registeredControllers: new Map(),
  registeredOperations: new Map(),
  instances: new Map(),
  argumentsTransforms: new Map(),
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
        Swagger.registerHandler(target, operation.operationId, undefined, operation.cb, operation.transformers);
      });
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
        cb: target[name],
        transformers: Swagger.registeredOperations.get(target.constructor.name + ':' + name)
      });
    }
  },

  Transform (...transformers) {
    return function (target, name, argIndex) {
      let operationTransformers = Swagger.registeredOperations.get(target.constructor.name + ':' + name);
      if (!operationTransformers) {
        operationTransformers = [];
        Swagger.registeredOperations.set(target.constructor.name + ':' + name, operationTransformers);
      }

      operationTransformers.push({
        transformers,
        argIndex
      });
    }
  },

  bind (constructor, instance) {
    this.instances.set(constructor, instance);
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

  start () {
    let controllers = {};

    this.handlers.forEach(({controller, operationId, context, cb, transformers}) => {
      // TODO: Separate to private function and explain logic with links
      controllers[`${controller.controllerName}_${operationId}`] = Meteor.bindEnvironment(function routeToHandler(req, res, next) {
        context = context || Swagger.instances.get(controller);

        try {
          getArgsFromParams(transformers, req.swagger.params)
            .then((args) => {
              return cb.apply(context, args);
            })
            .then((result) => {
              writeJsonToBody(res, result);
              res.end();
            })
            .catch((error) => {
              handleError(res, error, next);
            });
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

              controller[operationKey] = function (...args) {
                if (args.length === 0) {
                  args = [{}];
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

    this.clients.set(name, promise);
  },

  client(name) {
    return this.clients.get(name);
  },

  allowDocs() {
    this._allowDocs = true;
  }
};

function getArgsFromParams(transformers, params) {
  let promises = [];
  let index = 0;

  _.forEach(params, (param) => {
    let transformersList = _.findWhere(transformers, {argIndex: index});

    if (transformersList) {
      function handleTransformer(transformersContainer, tIndex) {
        let transformers = transformersContainer.transformers;
        let transformer = (transformers || [])[tIndex];

        if (transformer) {
          let transformerInstance = Swagger.instances.get(transformer);
          let returnValue = transformerInstance.transform.call(transformerInstance, param.value);

          return Promise.resolve(returnValue)
            .then((result) => {
              param.value = result;

              if (transformers[tIndex + 1]) {
                return handleTransformer(transformersContainer, tIndex + 1);
              }
              else {
                return param.value;
              }
            });
        }
        else {
          return Promise.resolve(param.value);
        }
      }

      promises.push(handleTransformer(transformersList, 0));
    }
    else {
      promises.push(Promise.resolve(param.value));
    }

    index++;
  });

  return Promise.all(promises);
}


