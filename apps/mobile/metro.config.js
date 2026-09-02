const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

// D&D deliberately shares framework-free domain/config modules with the web app.
// The repository is not declared as an npm workspace, so Metro needs the repo root
// in its file map and must prefer the mobile app's React Native dependencies.
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
module.exports = config;
