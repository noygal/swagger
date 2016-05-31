"use strict";
var underscore_1 = require('meteor/underscore');
var swaggerClient = Npm.require('swagger-client');
var SwaggerClient = (function () {
    function SwaggerClient(name, options, swaggerDefinition) {
        var _this = this;
        if (options === void 0) { options = { debug: false, logger: console }; }
        if (swaggerDefinition === void 0) { swaggerDefinition = null; }
        if (!swaggerDefinition) {
            var SwaggerConfig = global.SwaggerConfig;
            if (!SwaggerConfig) {
                throw "Cannot initialize SwaggerClient for " + name + " because no SwaggerConfig global was found.";
            }
            else if (!SwaggerConfig[name]) {
                throw "Cannot initialize SwaggerClient for " + name + " because no swagger-definition was provided and";
            }
            swaggerDefinition = SwaggerConfig[name];
        }
        this.name = name;
        this.promise = new Promise(function (resolve) {
            _this._api = new swaggerClient({
                spec: swaggerDefinition,
                success: function () {
                    underscore_1.default.forEach(_this._api.apisArray, function (currentApi) {
                        var controller = _this._api[currentApi.name];
                        underscore_1.default.forEach(controller.apis, function (operationMetadata, operationKey) {
                            var operation = controller[operationKey];
                            controller[operationKey] = function () {
                                var _this = this;
                                var args = [];
                                for (var _i = 0; _i < arguments.length; _i++) {
                                    args[_i - 0] = arguments[_i];
                                }
                                if (args.length === 0) {
                                    args = [{}];
                                }
                                if (options.debug) {
                                    options.logger.log('debug', "## SwaggerClient(" + this.name + ") ## About to run operation \" + operationKey + ' with transformed arguments: ", args);
                                }
                                return new Promise(function (resolve, reject) {
                                    operation.apply(_this, args.concat(resolve, reject));
                                });
                            };
                        });
                    });
                    resolve(_this._api);
                }
            });
        });
    }
    SwaggerClient.prototype.ready = function () {
        return this.promise;
    };
    SwaggerClient.prototype.api = function () {
        return this._api;
    };
    return SwaggerClient;
}());
exports.SwaggerClient = SwaggerClient;
