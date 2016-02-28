let safeLoad = Npm.require('js-yaml').safeLoad;

Plugin.registerCompiler({
  extensions: ['swagger-server.yaml']
}, function() {
  class SwaggerCompiler {
    processFilesForTarget(files) {
      files.forEach((file) => {
        let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
        let apiIdentifier = file.getBasename().replace('.swagger-server.yaml', '');

        file.addJavaScript({
          data : `
            Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc});
          `,
          path: file.getPathInPackage() + '.js'
        });
      });
    }
  }

  return new SwaggerCompiler();
});

Plugin.registerCompiler({
  extensions: ['swagger-client.yaml']
}, function() {
  class SwaggerCompiler {
    processFilesForTarget(files) {
      files.forEach((file) => {
        let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
        let clientName = file.getBasename().replace('.swagger-client.yaml', '');

        file.addJavaScript({
          data : `
            Swagger.createClient('${clientName}', ${swaggerDoc});
          `,
          path: file.getPathInPackage() + '.js'
        });
      });
    }
  }

  return new SwaggerCompiler();
});