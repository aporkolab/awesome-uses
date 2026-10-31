const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Schema } = require('../utils.js');
const data = require('../../src/data.js');

test('every url is listed only once', () => {
  const seen = new Set();
  const duplicates = data.map((p) => p.url).filter((url) => {
    if (seen.has(url)) return true;
    seen.add(url);
    return false;
  });
  assert.deepEqual(duplicates, []);
});

test("Adam Porkolab's entry is valid", () => {
  const entry = data.find((p) => p.url === 'https://adamporkolab.com/uses');
  assert.ok(entry, 'entry not found in src/data.js');
  assert.equal(Schema.validate(entry).error, undefined);
  assert.equal(new Set(entry.tags).size, entry.tags.length, 'duplicate tags');
});
