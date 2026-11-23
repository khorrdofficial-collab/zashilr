import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  sanitizeCustomLogoUrl,
  signSessionToken,
  validateAndSanitizeSeason,
  verifyHashedPassword,
  verifySessionToken,
} from './serverAuth';

test('scrypt password hashing verifies matching password and rejects wrong password', () => {
  const { salt, hash } = hashPassword('sample-pass-123');
  assert.equal(verifyHashedPassword('sample-pass-123', salt, hash), true);
  assert.equal(verifyHashedPassword('wrong-pass', salt, hash), false);
});

test('HMAC Bearer token signs, verifies, rejects tampering, expiry, and revocation', () => {
  const secret = 'test-signing-secret-key';
  const revoked = new Set<string>();
  const now = 1_700_000_000_000;

  const { token, jti } = signSessionToken('admin-user', secret, now);
  const verified = verifySessionToken(token, secret, revoked, now + 1000);
  assert.equal(verified?.sub, 'admin-user');

  // Tampered signature rejected
  const tampered = `${token.slice(0, -2)}xx`;
  assert.equal(verifySessionToken(tampered, secret, revoked, now + 1000), null);

  // Expired token rejected
  assert.equal(verifySessionToken(token, secret, revoked, now + 13 * 60 * 60 * 1000), null);

  // Revoked token rejected
  revoked.add(jti);
  assert.equal(verifySessionToken(token, secret, revoked, now + 1000), null);
});

test('sanitizeCustomLogoUrl blocks javascript: and SVG XSS data URLs while allowing safe raster base64', () => {
  assert.equal(sanitizeCustomLogoUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeCustomLogoUrl('data:image/svg+xml;base64,PHN2Zz4='), undefined);
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  assert.equal(sanitizeCustomLogoUrl(validPng), validPng);
});

test('validateAndSanitizeSeason rejects invalid team counts and unsafe logo schemes', () => {
  assert.equal(validateAndSanitizeSeason(null), null);
  assert.equal(validateAndSanitizeSeason({ id: 's1', name: 'Test', teams: [] }), null);
});
