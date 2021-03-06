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
const TYPINGS_PATH = "./server/typings/generated/";

let isGenerated = false;

function log() {
  console.log.apply(undefined, [LOG_IDENTIFIER].concat(Array.prototype.slice.call(arguments)));
}

class SwaggerCompiler extends CachingCompiler {
  constructor() {
    super({
      compilerName: 'SwaggerCompiler',
      defaultCacheSize: 1024 * 1024 * 10
    });

    this.gitCommitId = "";
    this.config = {};

    if (fs.existsSync(CONFIG_FILE)) {
      try {
        let rawContent = fs.readFileSync(CONFIG_FILE, 'utf8');
        this.config = JSON.parse(rawContent);
        this._cloneRemoteDefinitionsRepository();
      }
      catch (e) {
        log("Unable to read and parse swagger-config.json file", e);
        throw new Error("Unable to read and parse swagger-config.json file!");
      }

      try {
        if (this.config.generateTypings && !isGenerated) {
          log("Removing old typings...");
          this._deleteFolderRecursive(TYPINGS_PATH);
          log("Generating typings...");
          this._generateAllTypings(DEFINITIONS_PATH);
          log("Done generating typings...");
        }
      }
      catch (e) {
        log("Unable to generate typings due error:", e);
        throw e;
      }
    }
  }

  getCacheKey(inputFile) {
    return inputFile.getSourceHash();
  }

  compileResultSize(compileResult) {
    return compileResult.source.length + compileResult.sourceMap.length;
  }
  
  addCompileResult(inputFile, compileResult) {
    let filePath = 'server/' + inputFile.getPathInPackage() + '.js';

    inputFile.addJavaScript({
      data: compileResult.source,
      path: filePath
    });
  }

  compileOneFile(inputFile) {
    return this._handleOneSwaggerFile(inputFile);
  }

  _generateAllTypings(path) {
    fs.readdirSync(path).forEach((file) => {
      let curPath = path + "/" + file;

      if (fs.lstatSync(curPath).isDirectory()) {
        this._generateAllTypings(curPath);
      }
      else {
        if (curPath.indexOf("swagger.yaml") > -1) {
          this._generateTypings(curPath, file);
        }
      }
    });

    isGenerated = true;
  }

  _handleOneSwaggerFile(file) {
    let content;

    if (file.getBasename().indexOf(COMMON_SWAGGER_SUFFIX) > -1) {
      let cleanFilename = this._apiIdentifierName(file);

      if (this.config.api[cleanFilename]) {
        let apiType = this.config.api[cleanFilename];

        if (apiType === "client") {
          content = this._handleClient(file);
        }
        else if (apiType === "server") {
          content = this._handleServer(file);
        }
      }
    }

    content = content || '';

    return {source: content, sourceMap: content};
  }
  
  _cloneRemoteDefinitionsRepository() {
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

  _generateTypings(filePath, fileName) {
    let cleanFileName = this._apiIdentifierName(fileName);
    let definitionName = this._camelize(cleanFileName);

    if (this.config.api[cleanFileName]) {
      let fut = new Future();
      log(`Generating Typings files for ${definitionName}...`);

      swaggerToTypeScript(filePath, TYPINGS_PATH, definitionName, null, () => {
        fut.return();
      });

      return fut.wait();
    }
  }

  _handleClient(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
    log(`SwaggerConfig: added client definition for "${apiIdentifier}"`);

    return `SwaggerConfig = global.SwaggerConfig || {}; SwaggerConfig['${apiIdentifier}'] = {type: 'client', definition: ${swaggerDoc}};`;
  }

  _handleServer(file) {
    let apiIdentifier = this._apiIdentifierName(file);
    let swaggerDoc = JSON.stringify(safeLoad(file.getContentsAsString()));
    log(`SwaggerConfig: added server definition for "${apiIdentifier}"`);

    return `SwaggerConfig = global.SwaggerConfig || {}; SwaggerConfig['${apiIdentifier}'] = {type: 'server', definition: ${swaggerDoc}};`;
  }

  _apiIdentifierName(filePath) {
    if (typeof filePath !== "string") {
      filePath = filePath.getBasename();
    }

    return filePath.replace(SERVER_SWAGGER_SUFFIX, '').replace(CLIENT_SWAGGER_SUFFIX, '').replace(COMMON_SWAGGER_SUFFIX, '');
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
  extensions: ['swagger.yaml']
}, function () {
  return new SwaggerCompiler();
});