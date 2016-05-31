Package.describe({
  name: 'guild:swagger',
  version: '0.1.0',
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
  use: ['ecmascript', 'caching-compiler@1.0.3'],
  sources: [
    'plugin/swagger-yaml.js'
  ],
  npmDependencies: {
    'js-yaml': '3.5.3',
    'simple-git': '1.32.1',
    'swagger-to-typescript': 'https://github.com/hlandao/swagger-to-typescript/archive/c81ad18f845703d3c78482ce3de9cdde087a3d42.tar.gz'
  }
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use([
    'ecmascript',
    'underscore',
    'isobuild:compiler-plugin@1.0.0',
    'webapp']);
  api.addFiles('build/swagger-server.js', 'server');
  api.addFiles('build/swagger-client.js', 'server');
  api.addFiles('build/swagger-error.js', 'server');
  api.mainModule("build/index.js");
  api.export(['SwaggerServer', 'SwaggerClient', 'SwaggerError']);
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
