let Future = Npm.require('fibers/future');
let safeLoad = Npm.require('js-yaml').safeLoad;
let swaggerToTypeScript = Npm.require('swagger-to-typescript');
let simpleGit = require('simple-git')();
let fs = require('fs');

const CLIENT_SWAGGER_SUFFIX = ".swagger-client.yaml";
const SERVER_SWAGGER_SUFFIX = ".swagger-server.yaml";
const COMMON_SWAGGER_SUFFIX = ".swagger.yaml";
const DEFINITIONS_PATH      = "./swagger-definitions";
const SWAGGER_CODEGEN_JAR_PATH = ""

let counter = 0;

class SwaggerCompiler {
  constructor() {
    this.config = {};
  }

  locateAndProcessConfigFile(files) {
    let configFile = '';

    files.forEach((file) => {
      if (file.getBasename() === "swagger-config.json") {
        configFile = file.getContentsAsString();
      }
    });

    if(!configFile){
      return null
    }

    this.config = JSON.parse(configFile);

    return this.config;
  }
  
  cloneRemoteDefinitionsRepository() {
    const repository = this.config.repository;
    const commitId = this.config.commitId || "";
    if (!repository) {
      return
    }

    this._deleteFolderRecursive(DEFINITIONS_PATH);

    let fut = new Future();
    simpleGit.clone(repository, './swagger-definitions')
      .then(() => {
        this._deleteFolderRecursive(`${DEFINITIONS_PATH}/.git`);
        fut.return()
      }, () => {
        console.error(`[Swagger YAML] Fatal Error: cannot load swagger definitions from ${repository}`);
        fut.return()
      })

    return fut.wait()
  }


  handleClient(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || this._cleanDefinitionName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    return `Swagger.createClient('${apiIdentifier}', ${swaggerDoc});`;
  }

  handleServer(file, apiIdentifier) {
    apiIdentifier = apiIdentifier || this._cleanDefinitionName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
    return `Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc})`;
  }

  generateInterfaces(file, className) {
    let fileContent = safeLoad(file.getContentsAsString());
  }

  generateTypings(file) {
    let fut = new Future();
    let definitionName = this._camelize(this._cleanDefinitionName(file));
    swaggerToTypeScript(file.getPathInPackage(), './typings', definitionName, null, () => {
      fut.return()
    });
    return fut.wait()
  }

  processFilesForTarget(files) {
    let config = this.locateAndProcessConfigFile(files);
    this.cloneRemoteDefinitionsRepository();

    files.forEach((file) => {
      let content;

      if (file.getBasename().indexOf(SERVER_SWAGGER_SUFFIX) > -1) {
        content = this.handleServer(file);
      }
      else if (file.getBasename().indexOf(CLIENT_SWAGGER_SUFFIX) > -1) {
        content = this.handleClient(file);
      }
      else if (file.getBasename().indexOf(COMMON_SWAGGER_SUFFIX) > -1) {
        let cleanFilename = this._cleanDefinitionName(file);
        if (config.api[cleanFilename]) {
          let apiType = config.api[cleanFilename];

          if (apiType === "client") {
            content = this.handleClient(file);
          }
          else if (apiType === "server") {
            content = this.handleServer(file);
          }
        }
      }

      if (content) {

        if (this.config.generateTypings) {
          this.generateTypings(file)
        }

        file.addJavaScript({
          data: content,
          path: file.getPathInPackage() + '.js'
        });
      }

    });
  }
  _cleanDefinitionName(file) {
    return file.getBasename().replace(SERVER_SWAGGER_SUFFIX, '').replace(CLIENT_SWAGGER_SUFFIX, '').replace(COMMON_SWAGGER_SUFFIX,'');
  }

  _deleteFolderRecursive(path) {
    if( fs.existsSync(path) ) {
      fs.readdirSync(path).forEach((file,index) => {
        var curPath = path + "/" + file;
        if(fs.lstatSync(curPath).isDirectory()) { // recurse
          this._deleteFolderRecursive(curPath);
        } else { // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }
  _camelize(str) {
    return str.replace (/(?:^|[-_])(\w)/g, function (_, c) {
      return c ? c.toUpperCase () : '';
    })
  }

}

Plugin.registerCompiler({
  extensions: ['swagger-server.yaml', 'swagger-client.yaml', 'swagger.yaml'],
  filenames: ['swagger-config.json']
}, function () {
  return new SwaggerCompiler();
});