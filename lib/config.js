/**
 * Read/write `.agents/project.json` — agent contract for stack/runtime/commands/docs.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_VERSION = 1;
const RELATIVE_PATH = path.join('.agents', 'project.json');

/**
 * @typedef {Object} ProjectConfig
 * @property {number} version
 * @property {string} platform
 * @property {string} stack
 * @property {string} runtime
 * @property {string[]} libraries
 * @property {{ lint: string, test: string }} commands
 * @property {Array<{ id: string, url: string, version?: string }>} docsSources
 * @property {'deep'|'thin'} depth
 * @property {string} [updatedAt]
 */

/**
 * @param {string} targetDir
 * @returns {string}
 */
function configPath(targetDir) {
  return path.join(targetDir, RELATIVE_PATH);
}

/**
 * @param {string} targetDir
 * @returns {ProjectConfig|null}
 */
function readProjectConfig(targetDir) {
  const p = configPath(targetDir);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {string} targetDir
 * @param {Partial<ProjectConfig> & { stack: string, platform: string, runtime: string }} partial
 * @returns {ProjectConfig}
 */
function writeProjectConfig(targetDir, partial) {
  const agentsDir = path.join(targetDir, '.agents');
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  /** @type {ProjectConfig} */
  const config = {
    version: CONFIG_VERSION,
    platform: partial.platform,
    stack: partial.stack,
    runtime: partial.runtime,
    libraries: Array.isArray(partial.libraries) ? partial.libraries : [],
    commands: {
      lint: (partial.commands && partial.commands.lint) || 'npm run lint',
      test: (partial.commands && partial.commands.test) || 'npm test'
    },
    docsSources: Array.isArray(partial.docsSources) ? partial.docsSources : [],
    depth: partial.depth === 'deep' ? 'deep' : 'thin',
    updatedAt: new Date().toISOString()
  };

  const p = configPath(targetDir);
  fs.writeFileSync(p, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}

module.exports = {
  CONFIG_VERSION,
  RELATIVE_PATH,
  configPath,
  readProjectConfig,
  writeProjectConfig
};
