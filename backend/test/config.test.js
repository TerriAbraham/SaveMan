// Hosting settings pasted with the usual slips still work.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanSetting, tursoUrl } from '../src/config.js';

test('Turso URL: dashboard form, host only, quotes, spaces and NAME= lines', () => {
  const expected = 'https://saveman-terri.turso.io';
  for (const pasted of [
    'libsql://saveman-terri.turso.io',
    'saveman-terri.turso.io',
    '  libsql://saveman-terri.turso.io\n',
    '"libsql://saveman-terri.turso.io"',
    'TURSO_DATABASE_URL=libsql://saveman-terri.turso.io',
    'wss://saveman-terri.turso.io',
    'https://saveman-terri.turso.io',
  ]) {
    assert.equal(tursoUrl(pasted), expected, JSON.stringify(pasted));
  }
  assert.equal(tursoUrl(''), undefined);
  assert.equal(tursoUrl(undefined), undefined);
});

test('settings lose quotes and whitespace, but not real characters', () => {
  assert.equal(cleanSetting("'abc.def'"), 'abc.def');
  assert.equal(cleanSetting('abc\n.def '), 'abc.def');
  assert.equal(cleanSetting('"abc'), '"abc', 'an unmatched quote is part of the value');
  assert.equal(cleanSetting('TURSO_AUTH_TOKEN=xyz', 'TURSO_AUTH_TOKEN'), 'xyz');
});
