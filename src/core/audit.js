'use strict';

// Best-effort parsers for `outdated`/`audit` output across package managers.
// npm's JSON shapes are well documented and pnpm mirrors them closely, so
// those get real structure. yarn (classic, NDJSON) and bun (plain text)
// don't parse as a single JSON document, so callers fall back to raw text.

function parseOutdatedJson(stdout) {
  try {
    const data = JSON.parse(stdout);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const packages = Object.entries(data).map(([name, info]) => ({
        name,
        current: (info && info.current) || null,
        wanted: (info && info.wanted) || null,
        latest: (info && info.latest) || null,
      }));
      return { parsed: true, count: packages.length, packages };
    }
  } catch {
    // fall through
  }
  return { parsed: false, count: null, packages: [] };
}

function parseAuditJson(stdout) {
  try {
    const data = JSON.parse(stdout);
    const vulnerabilities = (data && data.metadata && data.metadata.vulnerabilities) || null;
    return { parsed: true, vulnerabilities, raw: vulnerabilities ? undefined : data };
  } catch {
    return { parsed: false, vulnerabilities: null };
  }
}

module.exports = { parseOutdatedJson, parseAuditJson };
