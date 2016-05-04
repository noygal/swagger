Package.describe({
  name: 'guild:swagger',
  version: '0.0.66',
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
  'js-yaml': '3.5.3'
});

Package.registerBuildPlugin({
  name: 'swagger',
  use: ['ecmascript', 'caching-compiler@1.0.4'],
  sources: [
    'plugin/swagger-yaml.js'
  ],
  npmDependencies: {
    'js-yaml': '3.5.3',
    'simple-git': '1.32.1',
    'swagger-to-typescript': 'https://github.com/hlandao/swagger-to-typescript/archive/8a38a3d8acbf7957b24c54ba5e243bca19961be2.tar.gz'
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
  api.export(['Swagger']);
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
});
