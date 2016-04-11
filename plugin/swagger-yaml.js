let safeLoad = Npm.require('js-yaml').safeLoad;

class SwaggerCompiler {
  constructor() {
    this.gitRepo = null;
    this.config = {};
  }

  locateAndProcessConfigFile(files) {
    let configFile = '';

    files.forEach((file) => {
      if (file.getBasename() === "swagger-config.json") {
        configFile = file.getContentsAsString();
      }
    });

    this.config = JSON.parse(configFile);

    return this.config;
  }

  handleClient(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || file.getBasename().replace('.swagger-client.yaml', '');
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    return `Swagger.createClient('${apiIdentifier}', ${swaggerDoc});`;
  }

  handleServer(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || file.getBasename().replace('.swagger-server.yaml', '');
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    if (this.config.generateTypings) {

    }

    return `Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc})`;
  }

  generateInterfaces(file, className) {
    let fileContent = safeLoad(file.getContentsAsString());
  }

  processFilesForTarget(files) {
    let config = this.locateAndProcessConfigFile(files);

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
          let apiType = config.api[cleanFilename];

          if (apiType === "client") {
            content = this.handleClient(file, cleanFilename);
          }
          else if (apiType === "server") {
            content = this.handleServer(file, cleanFilename);
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