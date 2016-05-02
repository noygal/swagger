let Future = Npm.require('fibers/future');
let safeLoad = Npm.require('js-yaml').safeLoad;
let swaggerToTypeScript = Npm.require('swagger-to-typescript');
let _simpleGit = require('simple-git');
let fs = require('fs');

const CLIENT_SWAGGER_SUFFIX = ".swagger-client.yaml";
const SERVER_SWAGGER_SUFFIX = ".swagger-server.yaml";
const COMMON_SWAGGER_SUFFIX = ".swagger.yaml";
const DEFINITIONS_PATH = "./swagger-definitions";

let alreadyRun = false;

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

  cloneRemoteDefinitionsRepository() {
    const repository = this.config.repository;
    const commitId = this.config.commitId || "";
    if (!repository) {
      return
    }
    this._deleteFolderRecursive(DEFINITIONS_PATH);
    let fut = new Future();
    let a = _simpleGit().clone(repository, './swagger-definitions', (err) => {
      if(err){
        console.error(`[Swagger YAML] Fatal Error1: cannot load swagger definitions from ${repository}`, err);
        fut.return()
        return
      }
      console.log(`[Swagger YAML] Successfully cloned the remote repo ${repository}.`);
      _simpleGit('./swagger-definitions').checkout(commitId, (err) => {
        if(err){
          console.error(`[Swagger YAML] Fatal Error2: cannot load swagger definitions from ${repository}`, err);
          fut.return()
          return
        }
        console.log(`[Swagger YAML] Successfully checked-out commit #${commitId}.`);
        this._deleteFolderRecursive(`${DEFINITIONS_PATH}/.git`);
        fut.return()
      })
    })
    return fut.wait()
  }

  generateTypings(file) {
    let fut = new Future();
    let definitionName = this._camelize(this._apiIdentifierName(file));
    console.log(`[Swagger Yaml] generate typings for ${definitionName}`)
    swaggerToTypeScript(file.getPathInPackage(), './typings', definitionName, null, () => {
      fut.return()
    });
    return fut.wait()
  }
  
  handleClient(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    console.log(`[Swagger Yaml] create client for ${apiIdentifier}`)
    return `Swagger.createClient('${apiIdentifier}', ${swaggerDoc});`;
  }

  handleServer(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));

    console.log(`[Swagger Yaml] load server defintion for ${apiIdentifier}`)

    return `Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc})`;
  }

  generateInterfaces(file, className) {
    let fileContent = safeLoad(file.getContentsAsString());
  }

  processFilesForTarget(files) {
    let config = this.locateAndProcessConfigFile(files);

    if(!alreadyRun) this.cloneRemoteDefinitionsRepository();
    
    files.forEach((file) => {
      let content;

      if (file.getBasename().indexOf(SERVER_SWAGGER_SUFFIX) > -1) {
        content = this.handleServer(file);
      }
      else if (file.getBasename().indexOf(CLIENT_SWAGGER_SUFFIX) > -1) {
        content = this.handleClient(file);
      }
      else if (file.getBasename().indexOf(COMMON_SWAGGER_SUFFIX) > -1) {
        let cleanFilename = this._apiIdentifierName(file);

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
        file.addJavaScript({
          data: content,
          path: 'server/' + file.getPathInPackage() + '.js'
        });
      }
    });

    if (!alreadyRun && config.generateTypings) {
      files.forEach((file) => {
        if (file.getBasename().indexOf(SERVER_SWAGGER_SUFFIX) > -1) {
          this.generateTypings(file)
        }
        else if (file.getBasename().indexOf(CLIENT_SWAGGER_SUFFIX) > -1) {
          this.generateTypings(file)
        }
        else if (file.getBasename().indexOf(COMMON_SWAGGER_SUFFIX) > -1) {
          let cleanFilename = this._apiIdentifierName(file);

          if (config.api[cleanFilename]) {
            this.generateTypings(file)
          }
        }
      })
    }

    alreadyRun = true
  }

  _apiIdentifierName(file) {
    return file.getBasename().replace(SERVER_SWAGGER_SUFFIX, '').replace(CLIENT_SWAGGER_SUFFIX, '').replace(COMMON_SWAGGER_SUFFIX, '');
  }
  _deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file, index) => {
        var curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          this._deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  }
  _camelize(str) {
    return str.replace(/(?:^|[-_])(\w)/g, function (_, c) {
      return c ? c.toUpperCase() : '';
    })
  }
}

Plugin.registerCompiler({
  extensions: ['swagger-server.yaml', 'swagger-client.yaml', 'swagger.yaml'],
  filenames: ['swagger-config.json']
}, function () {
  return new SwaggerCompiler();
});