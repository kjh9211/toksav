'use strict';

// Ordered by priority: the first matching key present in package.json#scripts
// wins. Kept intentionally small and explicit so verify/check never guess
// their way into running an unrelated (possibly destructive) script.
const CATEGORY_CANDIDATES = {
  lint: ['lint', 'eslint'],
  typecheck: ['typecheck', 'type-check', 'check-types', 'tsc'],
  test: ['test', 'test:unit'],
  build: ['build'],
};

function detectScript(scripts, category) {
  if (!scripts) return null;
  const candidates = CATEGORY_CANDIDATES[category];
  if (!candidates) return null;
  for (const name of candidates) {
    if (Object.prototype.hasOwnProperty.call(scripts, name)) {
      return name;
    }
  }
  return null;
}

module.exports = {
  CATEGORY_CANDIDATES,
  detectScript,
};
