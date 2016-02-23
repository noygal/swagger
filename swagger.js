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

Swagger = {
  debug: false,
  handlers: [],
  registeredControllers: new Map(),
  controllerInstances: new Map(),
  clients: new Map(),

  loadSwaggerDefinition (definition) {
    let parsedUrl = url.parse(Meteor.absoluteUrl());
    definition.host = `${parsedUrl.host}`;
    this.definition = definition;
  },

  Controller (name) {
    return function (target) {
      target.controllerName = name;
      Swagger.registeredControllers.get(target).forEach((operation) => {
        Swagger.registerHandler(name, operation.operationId, undefined, operation.cb);
      });
    }
  },

  Operation (operationId) {
    return function(target, name) {
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
    this.controllerInstances.set(constructor.controllerName, instance);
  },

  registerHandler (controller, operationId, context, cb) {
    this.handlers.push({
      controller,
      operationId,
      context,
      cb
    });
  },

  useStubs (useStubs) {
    this.stubs = useStubs;
  },

  start () {
    let controllers = {};

    this.handlers.forEach(({controller, operationId, context, cb}) => {
      // TODO: Separate to private function and explain logic with links
      controllers[`${controller}_${operationId}`] = Meteor.bindEnvironment(function routeToHandler(req, res, next) {
        let args = _.pluck(req.swagger.params, 'value');
        context = context || Swagger.controllerInstances.get(controller);

        try {
          let returnValue = cb.apply(context, args);
          if (isPromise(returnValue)) {
            returnValue.then((result) => {
                writeJsonToBody(res, result);
              })
              .catch((err) => {
                next(err);
              })
          }
          else {
            writeJsonToBody(res, returnValue);
            res.end();
          }
        }
        catch (error) {
          next(error);
        }
      });
    });

    swaggerTools.initializeMiddleware(this.definition, (middleware) => {
      WebApp.connectHandlers.use(middleware.swaggerMetadata());
      WebApp.connectHandlers.use(middleware.swaggerValidator());
      WebApp.connectHandlers.use(middleware.swaggerRouter({
        controllers,
        useStubs: this.stubs
      }));
      WebApp.connectHandlers.use(middleware.swaggerUi());
    });
  },

  createClient(name, swaggerDoc) {
    this.clients.set(name, new swaggerClient({
      spec: swaggerDoc,
      usePromise: true
    }));
  },

  client(name) {
    return this.clients.get(name);
  }
};
