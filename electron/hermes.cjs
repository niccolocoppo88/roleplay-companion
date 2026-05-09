/**
 * electron/hermes.cjs
 * Utilities for locating Hermes directories.
 */
const path = require('path');
const os = require('os');

function hermesHome() {
  return path.join(os.homedir(), '.hermes');
}

module.exports = { hermesHome };