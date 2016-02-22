let safeLoad = Npm.require('js-yaml').safeLoad;

Plugin.registerCompiler({
  extensions: ['swagger.yaml']
}, function() {
  class SwaggerCompiler {
    processFilesForTarget(files) {
      files.forEach((file) => {
        let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

        file.addJavaScript({
          data : `
            Swagger.loadSwaggerDefinition(${swaggerDoc});
          `,
          path: file.getPathInPackage() + '.js'
        });
      });
    }
  }

  return new SwaggerCompiler();
});