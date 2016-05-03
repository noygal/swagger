let Future = Npm.require('fibers/future');
let safeLoad = Npm.require('js-yaml').safeLoad;
let swaggerToTypeScript = Npm.require('swagger-to-typescript');
let _simpleGit = require('simple-git');
let fs = require('fs');

const CLIENT_SWAGGER_SUFFIX = ".swagger-client.yaml";
const SERVER_SWAGGER_SUFFIX = ".swagger-server.yaml";
const COMMON_SWAGGER_SUFFIX = ".swagger.yaml";
const DEFINITIONS_PATH = "./swagger-definitions";
const CONFIG_FILE = "./swagger-config.json";
const LOG_IDENTIFIER = "[Swagger YAML] ";

function log() {
  console.log.apply(undefined, [LOG_IDENTIFIER].concat(Array.prototype.slice.call(arguments)));
}

class SwaggerCompiler {
  constructor() {
    this.gitCommitId = "";
    this.config = {};

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        let rawContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        this.config = JSON.parse(rawContent);
        this.cloneRemoteDefinitionsRepository();
      }
      catch (e) {
        log("Unable to read and parse swagger-config.json file", e);
        throw "Unable to read and parse swagger-config.json file!";
      }
    }
  }

  cloneRemoteDefinitionsRepository() {
    const repository = this.config.repository;
    const commitId = this.config.commitId || "";
    if (!repository) {
      return;
    }

    let fut = new Future();

    if (this.gitCommitId != commitId) {
      this._deleteFolderRecursive(DEFINITIONS_PATH);

      _simpleGit().clone(repository, './swagger-definitions', (err) => {
        if (err) {
          log(`Fatal Error: cannot load swagger definitions from ${repository}`, err);

          return fut.return();
        }
        log(`Successfully cloned the remote repo ${repository}.`);
        _simpleGit('./swagger-definitions').checkout(commitId, (err) => {
          if (err) {
            log(`Fatal Error: cannot checkout the specific commit id definitions from ${repository}`, err);

            return fut.return();
          }

          log(`Successfully checked-out commit #${commitId}.`);
          this._deleteFolderRecursive(`${DEFINITIONS_PATH}/.git`);

          return fut.return();
        })
      });
    }
    else {
      fut.return();
    }

    return fut.wait();
  }

  generateTypings(file) {
    let fut = new Future();
    let definitionName = this._camelize(this._apiIdentifierName(file));
    log(`Generating Typings files for ${definitionName}...`);

    swaggerToTypeScript(file.getPathInPackage(), './typings', definitionName, null, () => {
      fut.return();
    });

    return fut.wait();
  }

  handleClient(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
    log(`Loaded client definition for "${apiIdentifier}"`);

    return `Swagger.createClient('${apiIdentifier}', ${swaggerDoc});`;
  }

  handleServer(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
    log(`Loaded server definition for "${apiIdentifier}"`);

    return `Swagger.loadSwaggerDefinition("${apiIdentifier}",${swaggerDoc})`;
  }

  processFilesForTarget(files) {
    files.forEach((file) => {
      let content;


      if (file.getBasename().indexOf(SERVER_SWAGGER_SUFFIX) > -1) {
        content = this.handleServer(file);
        this.config.generateTypings && this.generateTypings(file);
      }
      else if (file.getBasename().indexOf(CLIENT_SWAGGER_SUFFIX) > -1) {
        content = this.handleClient(file);
        this.config.generateTypings && this.generateTypings(file);
      }
      else if (file.getBasename().indexOf(COMMON_SWAGGER_SUFFIX) > -1) {
        let cleanFilename = this._apiIdentifierName(file);

        if (this.config.api[cleanFilename]) {
          let apiType = this.config.api[cleanFilename];

          if (apiType === "client") {
            content = this.handleClient(file);
          }
          else if (apiType === "server") {
            content = this.handleServer(file);
          }

          this.config.generateTypings && this.generateTypings(file);
        }
      }

      if (content) {
        file.addJavaScript({
          data: content,
          path: 'server/' + file.getPathInPackage() + '.js'
        });
      }
    });
  }

  _apiIdentifierName(file) {
    return file.getBasename().replace(SERVER_SWAGGER_SUFFIX, '').replace(CLIENT_SWAGGER_SUFFIX, '').replace(COMMON_SWAGGER_SUFFIX, '');
  }

  _deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file) => {
        let curPath = path + "/" + file;

        if (fs.lstatSync(curPath).isDirectory())
          this._deleteFolderRecursive(curPath);
        else
          fs.unlinkSync(curPath);
      });

      fs.rmdirSync(path);
    }
  }

  _camelize(str) {
    return str.replace(/(?:^|[-_])(\w)/g, function (_, c) {
      return c ? c.toUpperCase() : '';
    });
  }
}

Plugin.registerCompiler({
  extensions: ['swagger-server.yaml', 'swagger-client.yaml', 'swagger.yaml']
}, function () {
  return new SwaggerCompiler();
});