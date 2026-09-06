'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePorcelainV2, parseShortStat } = require('../src/core/git');

const FIXTURE = [
  '# branch.oid abc1234',
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -1',
  '1 M. N... 100644 100644 100644 1111111 1111111 src/foo.js',
  '1 .M N... 100644 100644 100644 2222222 2222222 src/bar.js',
  '2 R. N... 100644 100644 100644 3333333 3333333 R100 src/new.js\tsrc/old.js',
  'u UU N... 100644 100644 100644 100644 4444444 4444444 4444444 src/conflict.js',
  '? notes.txt',
  '! dist/',
].join('\n');

test('parses branch header fields', () => {
  const result = parsePorcelainV2(FIXTURE);
  assert.equal(result.branch, 'main');
  assert.equal(result.detached, false);
  assert.equal(result.upstream, 'origin/main');
  assert.equal(result.ahead, 2);
  assert.equal(result.behind, 1);
});

test('splits ordinary changes into staged vs unstaged by XY position', () => {
  const result = parsePorcelainV2(FIXTURE);
  assert.deepEqual(
    result.staged.map((f) => f.path),
    ['src/foo.js', 'src/new.js']
  );
  assert.deepEqual(
    result.unstaged.map((f) => f.path),
    ['src/bar.js']
  );
});

test('parses renamed entries with origPath', () => {
  const result = parsePorcelainV2(FIXTURE);
  const renamed = result.staged.find((f) => f.path === 'src/new.js');
  assert.equal(renamed.origPath, 'src/old.js');
});

test('parses unmerged, untracked and ignored entries', () => {
  const result = parsePorcelainV2(FIXTURE);
  assert.deepEqual(result.unmerged, [{ status: 'UU', path: 'src/conflict.js' }]);
  assert.deepEqual(result.untracked, ['notes.txt']);
  assert.deepEqual(result.ignored, ['dist/']);
});

test('handles an unborn branch (no commits yet)', () => {
  const result = parsePorcelainV2('# branch.oid (initial)\n# branch.head master\n? a.txt');
  assert.equal(result.initial, true);
  assert.equal(result.branch, 'master');
  assert.equal(result.ahead, 0);
  assert.equal(result.behind, 0);
});

test('handles a detached HEAD', () => {
  const result = parsePorcelainV2('# branch.oid abc\n# branch.head (detached)');
  assert.equal(result.detached, true);
  assert.equal(result.branch, null);
});

test('returns an empty structure for empty input', () => {
  const result = parsePorcelainV2('');
  assert.deepEqual(result.staged, []);
  assert.deepEqual(result.unstaged, []);
  assert.deepEqual(result.untracked, []);
});

test('parseShortStat extracts files/insertions/deletions', () => {
  const stat = parseShortStat(' 3 files changed, 82 insertions(+), 21 deletions(-)');
  assert.deepEqual(stat, { filesChanged: 3, insertions: 82, deletions: 21 });
});

test('parseShortStat handles singular and partial forms', () => {
  assert.deepEqual(parseShortStat(' 1 file changed, 1 insertion(+)'), {
    filesChanged: 1,
    insertions: 1,
    deletions: 0,
  });
  assert.deepEqual(parseShortStat(''), { filesChanged: 0, insertions: 0, deletions: 0 });
});
