const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

// D&D deliberately shares framework-free domain/config modules with the web app.
// The repository is not declared as an npm workspace, so Metro needs the repo root
// in its file map and must prefer the mobile app's React Native dependencies.
const dependencyRoots = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]
  .filter((p) => fs.existsSync(p))
  .map((p) => fs.realpathSync(p));
// Isolated worktrees may reuse dependencies via symlinks. Metro must see the
// resolved roots so shared domain imports resolve identically to a normal checkout.
config.watchFolders = [...new Set([monorepoRoot, ...dependencyRoots])];
config.resolver.nodeModulesPaths = dependencyRoots;
module.exports = config;
