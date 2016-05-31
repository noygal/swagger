import _ from 'meteor/underscore'
import {SwaggerError} from './swagger-error'
let swaggerTools = Npm.require('swagger-tools');
let url = Npm.require('url');

function writeJsonToBody(res, json) {
  if (json !== undefined) {
    let shouldPrettyPrint = (process.env.NODE_ENV === 'development');
    let spacer = shouldPrettyPrint ? 2 : null;
    let contentType = 'application/json';
    let content = json;

    if (!_.isObject(json) && _.isString(json) && (json.indexOf("<?xml") > -1 || json.indexOf("<?XML") > -1)) {
      content = json;
      contentType = "text/xml";
    }
    else if(_.isObject(json)) {
      content = JSON.stringify(json, null, spacer);
    }

    res.setHeader('Content-type', contentType);
    res.write(content);
  }
}

function defaultErrorHandler(err, req, res, next) {
  if(!err) next();

  if (err instanceof SwaggerError) {
    res.statusCode = err.httpCode;
    writeJsonToBody(res, err);
    res.end();
  } else if (typeof err === "string") {
    res.statusCode = 500;
    writeJsonToBody(res, {errorCode: 0, errorMessage: err});
    res.end();
  } else {
    SwaggerServer.logger.warn("Unkown error object", err);
    res.statusCode = 500;
    writeJsonToBody(res, {code: 500, error: "Unknown error"});
    res.end();
  }
}

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

  loadServerDefinition (identifier, definition) {
    let parsedUrl = url.parse(Meteor.absoluteUrl());
    definition.host = `${parsedUrl.host}`;
    this.definitions.set(identifier, definition);
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
            SwaggerServer.errorHandler ? Swagger.errorHandler(error, req, res, next) : defaultErrorHandler(error, req, res, next);
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

        if (Swagger.errorHandler) {
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

  _.forEach(params, (param) => {
    let transformersList = _.findWhere(transformers, {argIndex: index});

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

