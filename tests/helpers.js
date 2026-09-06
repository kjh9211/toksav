'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function makeTmpDir(prefix = 'ait-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { makeTmpDir, removeTmpDir };
