"use strict";
var swagger_error_1 = require('./swagger-error');
var forEach = _.forEach, findWhere = _.findWhere, isObject = _.isObject, isString = _.isString;
var swaggerTools = Npm.require('swagger-tools');
var url = Npm.require('url');
function inDevelopment() {
    return process.env.NODE_ENV === "development";
}
exports.SwaggerServer = {
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
    addConnectMiddleware: function (middlewareFn) {
        this.externalConnectMiddlewares.push(middlewareFn);
    },
    setErrorHandler: function (errHandler) {
        this.errorHandler = errHandler;
    },
    setLogger: function (logger) {
        this.logger = logger;
    },
    allowCors: function (origin) {
        this.cors = origin;
    },
    loadServerDefinition: function (identifier, swaggerDefinition) {
        if (!swaggerDefinition) {
            var SwaggerConfig = global.SwaggerConfig;
            if (!SwaggerConfig) {
                throw "Cannot load SwaggerServer for " + identifier + " because no SwaggerConfig global was found.";
            }
            else if (!SwaggerConfig[identifier]) {
                throw "Cannot load SwaggerServer for " + identifier + " because no swagger-definition was provided and";
            }
            swaggerDefinition = SwaggerConfig[identifier];
        }
        var parsedUrl = url.parse(Meteor.absoluteUrl());
        swaggerDefinition.host = "" + parsedUrl.host;
        this.definitions.set(identifier, swaggerDefinition);
    },
    Controller: function (name) {
        return function (target) {
            target.controllerName = name;
            exports.SwaggerServer.registeredControllers.get(target).forEach(function (operation) {
                exports.SwaggerServer.registerHandler(target, operation.operationId, undefined, operation.cb, operation.transformers, operation.namedParameters);
            });
        };
    },
    Operation: function (operationId) {
        return function (target, name) {
            var controllerOperations = exports.SwaggerServer.registeredControllers.get(target.constructor);
            if (!controllerOperations) {
                controllerOperations = [];
                exports.SwaggerServer.registeredControllers.set(target.constructor, controllerOperations);
            }
            controllerOperations.push({
                operationId: operationId,
                cb: target[name],
                namedParameters: exports.SwaggerServer.registeredParamters.get(target.constructor.name + ':' + name),
                transformers: exports.SwaggerServer.registeredOperations.get(target.constructor.name + ':' + name)
            });
        };
    },
    Parameter: function (parameterName) {
        return function (target, name, argIndex) {
            var parameters = exports.SwaggerServer.registeredParamters.get(target.constructor.name + ':' + name);
            if (!parameters) {
                parameters = [];
                exports.SwaggerServer.registeredParamters.set(target.constructor.name + ':' + name, parameters);
            }
            parameters.push({
                parameterName: parameterName,
                argIndex: argIndex
            });
        };
    },
    Transform: function () {
        var transformers = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            transformers[_i - 0] = arguments[_i];
        }
        return function (target, name, argIndex) {
            var operationTransformers = exports.SwaggerServer.registeredOperations.get(target.constructor.name + ':' + name);
            if (!operationTransformers) {
                operationTransformers = [];
                exports.SwaggerServer.registeredOperations.set(target.constructor.name + ':' + name, operationTransformers);
            }
            operationTransformers.push({
                transformers: transformers,
                argIndex: argIndex
            });
        };
    },
    bind: function (constructor, instance) {
        this.instances.set(constructor, instance);
    },
    registerHandler: function (controller, operationId, context, cb, transformers, namedParameters) {
        this.handlers.push({
            controller: controller,
            operationId: operationId,
            context: context,
            cb: cb,
            namedParameters: namedParameters || [],
            transformers: (transformers || []).reverse()
        });
    },
    useStubs: function (useStubs) {
        this.stubs = useStubs;
    },
    debugMode: function (debugMode) {
        this.debug = debugMode;
    },
    printRaw: function (isRaw) {
        this.raw = isRaw;
    },
    start: function () {
        var _this = this;
        var controllers = {};
        this.handlers.forEach(function (_a) {
            var controller = _a.controller, operationId = _a.operationId, context = _a.context, cb = _a.cb, transformers = _a.transformers, namedParameters = _a.namedParameters;
            context = context || exports.SwaggerServer.instances.get(controller);
            if (!context) {
                delete controllers[(controller.controllerName + "_" + operationId)];
                return;
            }
            // TODO: Separate to private function and explain logic with links
            controllers[(controller.controllerName + "_" + operationId)] = Meteor.bindEnvironment(function routeToHandler(req, res, next) {
                try {
                    getArgsFromParams(transformers, req.swagger.params)
                        .then(function (args) {
                        namedParameters.forEach(function (parameter) {
                            args[parameter.argIndex] = (req.swagger.params[parameter.parameterName] || {}).originalValue;
                        });
                        if (exports.SwaggerServer.debug) {
                            exports.SwaggerServer.logger.log('debug', "#### Running handler for " + controller.controllerName + "#" + operationId + " with params:");
                            for (var _i = 0, _a = Object.keys(req.swagger.params); _i < _a.length; _i++) {
                                var key = _a[_i];
                                exports.SwaggerServer.logger.log('debug', key + "=", req.swagger.params[key].value);
                            }
                            exports.SwaggerServer.logger.log('debug', "End params for " + controller.controllerName + "_" + operationId + " ####");
                        }
                        return cb.apply(context, args);
                    })
                        .then(function (result) {
                        writeJsonToBody(res, result);
                        res.end();
                    })
                        .catch(function (error) {
                        exports.SwaggerServer.errorHandler ? exports.SwaggerServer.errorHandler(error, req, res, next) : defaultErrorHandler(error, req, res, next);
                    });
                }
                catch (error) {
                    try {
                        var error_1 = new swagger_error_1.SwaggerError(500, "0", "Fatal Error: unexpected error");
                        exports.SwaggerServer.errorHandler ? Swagger.errorHandler(error_1, req, res, next) : defaultErrorHandler(error_1, req, res, next);
                    }
                    catch (e) {
                        var error_2 = new swagger_error_1.SwaggerError(500, "0", "Fatal Error: handling error failed");
                        defaultErrorHandler(error_2, req, res, next);
                    }
                }
            });
        });
        if (inDevelopment() || this._allowDocs) {
            WebApp.connectHandlers.use(function (req, res, next) {
                if (req.url === '/docs' || req.url === '/docs/') {
                    res.setHeader('content-type', 'text/html');
                    var response_1 = '<h2>All Swagger APIs</h2><ul>';
                    _this.definitions.forEach(function (definition, identifier) {
                        response_1 += "<li>\n                          <a href=\"/" + identifier + "/docs\">\n                            <h4>" + definition.info.title + "<h4>\n                          </a>\n                        </li>";
                    });
                    res.write(response_1);
                    res.end();
                }
                else {
                    next();
                }
            });
        }
        this.definitions.forEach(function (definition, identifier) {
            swaggerTools.initializeMiddleware(definition, function (middleware) {
                exports.SwaggerServer.externalConnectMiddlewares.forEach(function (middlewareFn) {
                    WebApp.connectHandlers.use(middlewareFn);
                });
                if (exports.SwaggerServer.cors) {
                    WebApp.connectHandlers.use(function (err, req, res, next) {
                        res.setHeader('Access-Control-Allow-Origin', exports.SwaggerServer.cors);
                        next();
                    });
                }
                WebApp.connectHandlers.use(middleware.swaggerMetadata());
                WebApp.connectHandlers.use(middleware.swaggerValidator());
                WebApp.connectHandlers.use(middleware.swaggerRouter({
                    controllers: controllers,
                    useStubs: _this.stubs
                }));
                if (Swagger.errorHandler) {
                    WebApp.connectHandlers.use(function (err, req, res, next) {
                        return exports.SwaggerServer.errorHandler(err, req, res, next);
                    });
                }
                if (inDevelopment() || _this._allowDocs) {
                    WebApp.connectHandlers.use(middleware.swaggerUi({
                        swaggerUi: "/" + identifier + "/docs",
                        apiDocs: "/" + identifier + "/api-docs"
                    }));
                }
            });
        });
    },
    allowDocs: function () {
        this._allowDocs = true;
    }
};
function getArgsFromParams(transformers, params) {
    var promises = [];
    var index = 0;
    forEach(params, function (param) {
        var transformersList = findWhere(transformers, { argIndex: index });
        if (transformersList) {
            function handleTransformer(transformersContainer, tIndex, isRequired) {
                var transformers = transformersContainer.transformers;
                var transformer = (transformers || [])[tIndex];
                if (transformer) {
                    var transformerInstance = exports.SwaggerServer.instances.get(transformer);
                    var returnValue = transformerInstance.transform.call(transformerInstance, param.value, param.schema.required);
                    return Promise.resolve(returnValue)
                        .then(function (result) {
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
function writeJsonToBody(res, json) {
    if (json !== undefined) {
        var shouldPrettyPrint = (process.env.NODE_ENV === 'development');
        var spacer = shouldPrettyPrint ? 2 : null;
        var contentType = 'application/json';
        var content = json;
        if (!isObject(json) && isString(json) && (json.indexOf("<?xml") > -1 || json.indexOf("<?XML") > -1)) {
            content = json;
            contentType = "text/xml";
        }
        else if (isObject(json)) {
            content = JSON.stringify(json, null, spacer);
        }
        res.setHeader('Content-type', contentType);
        res.write(content);
    }
}
exports.writeJsonToBody = writeJsonToBody;
function defaultErrorHandler(err, req, res, next) {
    if (!err)
        next();
    var swaggerError;
    if (err instanceof swagger_error_1.SwaggerError) {
        swaggerError = err;
    }
    else if (typeof err === "string") {
        swaggerError = new swagger_error_1.SwaggerError(500, err, "0");
    }
    else {
        try {
            if (err.toString().indexOf("Cannot resolve the configured swagger-router") != -1) {
                exports.SwaggerServer.logger.warn('Tried to access non-exists or disabled endpoint!', err);
                swaggerError = new swagger_error_1.SwaggerError(404, "Tried to access non-exists or disabled endpoint", "0");
            }
            else if (err.failedValidation && err.results && err.results.errors) {
                swaggerError = new swagger_error_1.SwaggerError(err.httpCode || 400, 'Failed validation', "0", {
                    errors: err.results.errors
                });
            }
        }
        catch (e) {
        }
    }
    if (!swaggerError) {
        swaggerError = new swagger_error_1.SwaggerError(500, 'Unexpected error', "0");
    }
    res.statusCode = swaggerError.httpCode;
    writeJsonToBody(res, swaggerError);
    res.end();
}
exports.defaultErrorHandler = defaultErrorHandler;
