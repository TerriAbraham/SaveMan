import assert from 'node:assert/strict';
import { test } from 'node:test';

import { base32Decode, base32Encode, generateSecret, hotp, otpauthUrl, totpAt, verifyTotp } from '../src/totp.js';

const RFC_SECRET = Buffer.from('12345678901234567890');

test('HOTP matches the RFC 4226 test vectors', () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  expected.forEach((code, counter) => assert.equal(hotp(RFC_SECRET, counter), code));
});

test('TOTP (SHA-1) matches the RFC 6238 test vectors', () => {
  const vectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [seconds, code] of vectors) assert.equal(hotp(RFC_SECRET, Math.floor(seconds / 30), 8), code);
});

test('Base32 round-trips and generated secrets are 160-bit', () => {
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.deepEqual(base32Decode('MZXW6YTBOI'), Buffer.from('foobar'));
  const secret = generateSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(base32Decode(secret).length, 20);
  assert.notEqual(generateSecret(), secret);
});

test('verifyTotp accepts ±1 step, rejects replays, older steps and bad input', () => {
  const secret = generateSecret();
  const t = Date.parse('2026-11-07T10:00:15Z');
  const step = Math.floor(t / 30000);

  assert.equal(verifyTotp(secret, totpAt(secret, t), { nowMs: t }), step);
  assert.equal(verifyTotp(secret, totpAt(secret, t - 30000), { nowMs: t }), step - 1);
  assert.equal(verifyTotp(secret, totpAt(secret, t + 30000), { nowMs: t }), step + 1);
  assert.equal(verifyTotp(secret, totpAt(secret, t - 60000), { nowMs: t }), null, 'two steps old');
  assert.equal(verifyTotp(secret, totpAt(secret, t), { nowMs: t, lastUsedStep: step }), null, 'replay');
  for (const bad of ['', '12345', '1234567', 'abcdef', null, 123456]) assert.equal(verifyTotp(secret, bad, { nowMs: t }), null);
});

test('otpauth URL is in the Key URI format authenticator apps read', () => {
  const url = new URL(otpauthUrl({ secret: 'JBSWY3DPEHPK3PXP', accountName: 'admin@saveman.pg', issuer: 'SaveMan' }));
  assert.equal(url.protocol, 'otpauth:');
  assert.equal(url.host, 'totp');
  assert.equal(decodeURIComponent(url.pathname), '/SaveMan:admin@saveman.pg');
  assert.equal(url.searchParams.get('secret'), 'JBSWY3DPEHPK3PXP');
  assert.equal(url.searchParams.get('issuer'), 'SaveMan');
  assert.equal(url.searchParams.get('digits'), '6');
  assert.equal(url.searchParams.get('period'), '30');
});
