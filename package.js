Package.describe({
  name: 'guild:swagger',
  version: '0.1.9.1',
  // Brief, one-line summary of the package.
  summary: 'Rest API based on swagger',
  // URL to the Git repository containing the source code for this package.
  git: 'https://github.com/GuildOfProgrammers/swagger',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
  'swagger-tools' : '0.10.1',
  'swagger-client': 'https://github.com/dotansimha/swagger-js/archive/d3fe00b5e7600887d07a942c383aa1ed0898a684.tar.gz',
  'js-yaml': '3.5.3'
});

Package.registerBuildPlugin({
  name: 'swagger',
  use: ['ecmascript', 'caching-compiler@1.0.3', 'barbatus:typescript@0.3.1'],
  sources: [
    'plugin/swagger-yaml.js'
  ],
  npmDependencies: {
    'js-yaml': '3.5.3',
    'simple-git': '1.32.1',
    'swagger-to-typescript': 'https://github.com/hlandao/swagger-to-typescript/archive/ed729ebe194abd710f36469ad0b24f76493d8287.tar.gz'
  }
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use([
    'barbatus:typescript',
    'ecmascript',
    'underscore',
    'isobuild:compiler-plugin@1.0.0',
    'webapp']);
  api.addFiles('src/swagger-server.ts', 'server');
  api.addFiles('src/swagger-client.ts', 'server');
  api.addFiles('src/swagger-error.ts', 'server');
  api.mainModule("src/index.ts");
  api.export(['SwaggerServer', 'SwaggerClient', 'SwaggerError']);
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
