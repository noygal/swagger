import {SwaggerError} from './swagger-error'
declare var _;

const {forEach, findWhere, isObject, isString} = _;

let swaggerTools = Npm.require('swagger-tools');
let url = Npm.require('url');

function inDevelopment() {
  return process.env.NODE_ENV === "development";
}

export const SwaggerServer = {
  debug: false,
  raw: false,
  cors: false,
  handlers: [],
  registeredControllers: new Map(),
  registeredOperations: new Map(),
  registeredParamters: new Map(),
  instances: new Map(),
  argumentsTransforms: new Map(),
  definitions: new Map(),
  logger: console,
  errorHandler: undefined,
  externalConnectMiddlewares: [],
  
  addConnectMiddleware(middlewareFn) {
    this.externalConnectMiddlewares.push(middlewareFn);
  },

  setErrorHandler(errHandler) {
    this.errorHandler = errHandler;
  },

  setLogger(logger) {
    this.logger = logger;
  },

  allowCors(origin) {
    this.cors = origin;
  },

  loadServerDefinition (identifier, swaggerDefinition?) {
    if(!swaggerDefinition) {
      let SwaggerConfig = global.SwaggerConfig;
      if(!SwaggerConfig) {
        throw `Cannot load SwaggerServer for "${identifier}" because no SwaggerConfig global was found.`
      } else if (!SwaggerConfig[identifier] || !SwaggerConfig[identifier].definition) {
        throw `Cannot load SwaggerServer for "${identifier}" because no swagger-definition was provided`
      }

      swaggerDefinition = SwaggerConfig[identifier].definition;
    }
    let parsedUrl = url.parse(Meteor.absoluteUrl());
    swaggerDefinition.host = `${parsedUrl.host}`;
    this.definitions.set(identifier, swaggerDefinition);
  },

  Controller (name) {
    return function (target) {
      target.controllerName = name;
      SwaggerServer.registeredControllers.get(target).forEach((operation) => {
        SwaggerServer.registerHandler(target, operation.operationId, undefined, operation.cb, operation.transformers, operation.namedParameters);
      });
    }
  },

  Operation (operationId) {
    return function (target, name) {
      let controllerOperations = SwaggerServer.registeredControllers.get(target.constructor);
      if (!controllerOperations) {
        controllerOperations = [];
        SwaggerServer.registeredControllers.set(target.constructor, controllerOperations);
      }

      controllerOperations.push({
        operationId,
        cb: target[name],
        namedParameters: SwaggerServer.registeredParamters.get(target.constructor.name + ':' + name),
        transformers: SwaggerServer.registeredOperations.get(target.constructor.name + ':' + name)
      });
    }
  },

  Parameter (parameterName) {
    return function (target, name, argIndex) {
      let parameters = SwaggerServer.registeredParamters.get(target.constructor.name + ':' + name);

      if (!parameters) {
        parameters = [];
        SwaggerServer.registeredParamters.set(target.constructor.name + ':' + name, parameters);
      }

      parameters.push({
        parameterName,
        argIndex
      });
    }
  },

  Transform (...transformers) {
    return function (target, name, argIndex) {
      let operationTransformers = SwaggerServer.registeredOperations.get(target.constructor.name + ':' + name);
      if (!operationTransformers) {
        operationTransformers = [];
        SwaggerServer.registeredOperations.set(target.constructor.name + ':' + name, operationTransformers);
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

  registerHandler (controller, operationId, context, cb, transformers, namedParameters) {
    this.handlers.push({
      controller,
      operationId,
      context,
      cb,
      namedParameters: namedParameters || [],
      transformers: (transformers || []).reverse()
    });
  },

  useStubs (useStubs) {
    this.stubs = useStubs;
  },

  debugMode (debugMode) {
    this.debug = debugMode;
  },

  printRaw(isRaw) {
    this.raw = isRaw;
  },

  start () {
    let controllers = {};

    this.handlers.forEach(({controller, operationId, context, cb, transformers, namedParameters}) => {
      context = context || SwaggerServer.instances.get(controller);

      if (!context) {
        delete controllers[`${controller.controllerName}_${operationId}`];
        
        return;
      }
      
      // TODO: Separate to private function and explain logic with links
      controllers[`${controller.controllerName}_${operationId}`] = Meteor.bindEnvironment(function routeToHandler(req, res, next) {
        try {
          getArgsFromParams(transformers, req.swagger.params)
            .then((args) => {
              namedParameters.forEach((parameter) => {
                args[parameter.argIndex] = (req.swagger.params[parameter.parameterName] || {}).originalValue;
              });

              if(SwaggerServer.debug) {
                SwaggerServer.logger.log('debug', `#### Running handler for ${controller.controllerName}#${operationId} with params:`)
                for (var key of Object.keys(req.swagger.params)) {
                  SwaggerServer.logger.log('debug', `${key}=`,req.swagger.params[key].value)
                }
                SwaggerServer.logger.log('debug', `End params for ${controller.controllerName}_${operationId} ####`)
              }

              return cb.apply(context, args);
            })
            .then((result) => {
              writeJsonToBody(res, result);
              res.end();
            })
            .catch((error) => {
              SwaggerServer.errorHandler ? SwaggerServer.errorHandler(error, req, res, next) : defaultErrorHandler(error, req, res, next);
            });
        }
        catch (error) {
          try {
            let error = new SwaggerError(500, "0", "Fatal Error: unexpected error");
            SwaggerServer.errorHandler ? SwaggerServer.errorHandler(error, req, res, next) : defaultErrorHandler(error, req, res, next);
          } catch (e) {
            let error = new SwaggerError(500, "0", "Fatal Error: handling error failed");
            defaultErrorHandler(error, req, res, next);
          }
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
        SwaggerServer.externalConnectMiddlewares.forEach((middlewareFn) => {
          WebApp.connectHandlers.use(middlewareFn);
        });

        if (SwaggerServer.cors) {
          WebApp.connectHandlers.use((err, req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', SwaggerServer.cors);

            next();
          });
        }

        WebApp.connectHandlers.use(middleware.swaggerMetadata());
        WebApp.connectHandlers.use(middleware.swaggerValidator());
        WebApp.connectHandlers.use(middleware.swaggerRouter({
          controllers,
          useStubs: this.stubs
        }));

        if (SwaggerServer.errorHandler) {
          WebApp.connectHandlers.use((err, req, res, next) => {
            return SwaggerServer.errorHandler(err, req, res, next);
          });
        }

        if (inDevelopment() || this._allowDocs) {
          WebApp.connectHandlers.use(middleware.swaggerUi({
            swaggerUi: `/${identifier}/docs`,
            apiDocs: `/${identifier}/api-docs`
          }));
        }
      });
    });
  },
  
  allowDocs() {
    this._allowDocs = true;
  }
};

function getArgsFromParams(transformers, params) {
  let promises = [];
  let index = 0;

  forEach(params, (param) => {
    let transformersList = findWhere(transformers, {argIndex: index});

    if (transformersList) {
      function handleTransformer(transformersContainer, tIndex, isRequired) {
        let transformers = transformersContainer.transformers;
        let transformer = (transformers || [])[tIndex];

        if (transformer) {
          let transformerInstance = SwaggerServer.instances.get(transformer);
          let returnValue = transformerInstance.transform.call(transformerInstance, param.value, param.schema.required);

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

export function writeJsonToBody(res, json) {
  if (json !== undefined) {
    let shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    let spacer = shouldPrettyPrint ? 2 : null;
    let contentType = 'application/json';
    let content = json;

    if (!isObject(json) && isString(json) && (json.indexOf("<?xml") > -1 || json.indexOf("<?XML") > -1)) {
      content = json;
      contentType = "text/xml";
    }
    else if(isObject(json)) {
      content = JSON.stringify(json, null, spacer);
    }

    res.setHeader('Content-type', contentType);
    res.write(content);
  }
}

export function defaultErrorHandler(err, req, res, next) {
  if(!err) next();

  let swaggerError;
  if (err instanceof SwaggerError) {
    swaggerError = err;
  } else if (typeof err === "string") {
    swaggerError = new SwaggerError(500, err, "0");
  } else {
    try {
      if (err.toString().indexOf("Cannot resolve the configured swagger-router") != -1) {
        SwaggerServer.logger.warn('Tried to access non-exists or disabled endpoint!', err);
        swaggerError = new SwaggerError(404, "Tried to access non-exists or disabled endpoint", "0");
      } else if (err.failedValidation && err.results && err.results.errors) {
        swaggerError = new SwaggerError(err.httpCode || 400, 'Failed validation', "0", {
          errors: err.results.errors
        })
      }
    } catch (e) {

    }
  }

  if(!swaggerError) {
    swaggerError = new SwaggerError(500, 'Unexpected error', "0");
  }

  res.statusCode = swaggerError.httpCode;
  writeJsonToBody(res, swaggerError);
  res.end();
}
