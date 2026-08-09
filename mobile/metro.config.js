// Metro config for the Verdyn monorepo. Lets the app resolve and transpile the
// shared @verdyn/core TypeScript source from packages/core.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes to @verdyn/core hot-reload. Append to
//    Expo's defaults rather than replacing them.
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

// 2. Resolve modules from both the app and the workspace root. Hierarchical
//    lookup stays on (the default): a single React is hoisted to the workspace
//    root via the `overrides` in the root package.json, so Metro walks up and
//    finds exactly one copy — no need to disable hierarchical lookup.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
