let safeLoad = Npm.require('js-yaml').safeLoad;
let CodeGen = Npm.require('swagger-js-codegen').CodeGen;

class SwaggerCompiler {
  constructor() {
    this.gitRepo = null;
  }

  locateAndProcessConfigFile(files) {
    let configFile;

    files.forEach((file) => {
      if (file.getBasename() === "swagger-config.json") {
        configFile = file.getContentsAsString();
      }
    });

    return configFile;
  }

  handleClient(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || file.getBasename().replace('.swagger-client.yaml', '');
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    return `Swagger.createClient('${apiIdentifier}', ${swaggerDoc});`;
  }

  handleServer(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || file.getBasename().replace('.swagger-server.yaml', '');
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    return `Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc})`;
  }

  generateInterfaces(file, className) {
    let fileContent = safeLoad(file.getContentsAsString());
  }

  processFilesForTarget(files) {
    let config = JSON.parse(this.locateAndProcessConfigFile(files));

    files.forEach((file) => {
      let content;

      if (file.getBasename().indexOf('swagger-server.yaml') > -1) {
        content = this.handleServer(file);
      }
      else if (file.getBasename().indexOf('swagger-client.yaml') > -1) {
        content = this.handleClient(file);
      }
      else if (file.getBasename().indexOf('swagger.yaml') > -1) {
        let cleanFilename = file.getBasename().replace('.swagger.yaml', '');

        if (config.api[cleanFilename]) {
          localApis[cleanFilename] = true;
          let apiType = config.api[cleanFilename];

          if (apiType === "client") {
            content = this.handleClient(file, cleanFilename);
          }
          else if (apiType === "server") {
            content = this.handleServer(file, cleanFilename);
            this.generateInterfaces(file, cleanFilename);
          }
        }
      }

      if (content) {
        file.addJavaScript({
          data: content,
          path: file.getPathInPackage() + '.js'
        });
      }
    });
  }
}

Plugin.registerCompiler({
  extensions: ['swagger-server.yaml', 'swagger-client.yaml', 'swagger.yaml'],
  filenames: ['swagger-config.json']
}, function () {
  return new SwaggerCompiler();
});