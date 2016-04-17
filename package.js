Package.describe({
  name: 'guild:swagger',
  version: '0.0.41',
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
  'swagger-client': 'https://github.com/dotansimha/swagger-js/archive/087753c582727f712147118776083972f7c22e73.tar.gz',
  'js-yaml': '3.5.5',
  'swagger-to-typescript': '1.0.24'
});

Package.registerBuildPlugin({
  name: 'swagger',
  use: ['ecmascript'],
  sources: [
    'plugin/swagger-yaml.js'
  ],
  npmDependencies: {
    'js-yaml': '3.5.3',
    'simple-git': '1.32.0',
    'swagger-to-typescript': '1.0.24'
  }
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use([
    'ecmascript',
    'underscore',
    'isobuild:compiler-plugin@1.0.0',
    'webapp']);
  api.addFiles('swagger.js', 'server');
  api.export(['ISwaggerRequestTransform', 'Swagger']);
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
