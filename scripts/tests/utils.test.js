const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Schema, getStatusCode } = require('../utils.js');

const validPerson = {
  name: 'Jane Doe',
  description: 'Web developer',
  url: 'https://example.com/uses',
  country: '🇭🇺',
};

describe('Schema', () => {
  test('accepts a minimal valid entry', () => {
    assert.equal(Schema.validate(validPerson).error, undefined);
  });

  test('accepts all optional fields', () => {
    const { error } = Schema.validate({
      ...validPerson,
      twitter: '@jane_doe',
      mastodon: '@jane@mastodon.social',
      bluesky: 'jane.bsky.social',
      emoji: '🦾',
      computer: 'linux',
      phone: 'android',
      tags: ['JavaScript', 'Vim'],
    });
    assert.equal(error, undefined);
  });

  for (const field of ['name', 'description', 'url', 'country']) {
    test(`requires "${field}"`, () => {
      const { [field]: _omitted, ...person } = validPerson;
      const { error } = Schema.validate(person);
      assert.ok(error);
      assert.match(error.message, new RegExp(`"${field}" is required`));
    });
  }

  test('rejects a url that is not a uses page', () => {
    const { error } = Schema.validate({
      ...validPerson,
      url: 'https://example.com/about',
    });
    assert.ok(error);
  });

  test('accepts gist urls', () => {
    const { error } = Schema.validate({
      ...validPerson,
      url: 'https://gist.github.com/jane/abc123',
    });
    assert.equal(error, undefined);
  });

  test('rejects unknown countries, computers and phones', () => {
    assert.ok(Schema.validate({ ...validPerson, country: 'HU' }).error);
    assert.ok(Schema.validate({ ...validPerson, computer: 'amiga' }).error);
    assert.ok(Schema.validate({ ...validPerson, phone: 'pager' }).error);
  });

  test('rejects malformed social handles', () => {
    assert.ok(
      Schema.validate({ ...validPerson, twitter: '@this_handle_is_way_too_long' })
        .error
    );
    assert.ok(Schema.validate({ ...validPerson, mastodon: '@jane' }).error);
    assert.ok(Schema.validate({ ...validPerson, bluesky: '@jane.bsky.social' }).error);
  });

  test('rejects unknown keys', () => {
    assert.ok(Schema.validate({ ...validPerson, github: 'jane' }).error);
  });
});

describe('getStatusCode', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/uses') {
        res.end('ok');
      } else if (req.url === '/ua') {
        const ok = /awesome-uses-link-checker/.test(req.headers['user-agent']);
        res.statusCode = ok ? 200 : 403;
        res.end();
      } else if (req.url === '/slow') {
        // never respond
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  test('resolves with the response status code', async () => {
    assert.equal(await getStatusCode(`${baseUrl}/uses`), 200);
    assert.equal(await getStatusCode(`${baseUrl}/missing`), 404);
  });

  test('sends a browser-like User-Agent', async () => {
    assert.equal(await getStatusCode(`${baseUrl}/ua`), 200);
  });

  test('rejects when the host does not answer in time', async () => {
    const started = Date.now();
    await assert.rejects(getStatusCode(`${baseUrl}/slow`, { timeout: 100 }), {
      message: 'Request timed out',
    });
    assert.ok(Date.now() - started < 2000, 'timeout option was not honored');
  });

  test('rejects on connection errors', async () => {
    await assert.rejects(getStatusCode('http://127.0.0.1:1/uses'));
  });
});
