import crypto from 'node:crypto';
import type { Season } from '../types/league.ts';

export interface StoredAdminCredential {
  username: string;
  passwordSalt: string;
  passwordHash: string;
  claimedAt: string;
}

const SCRYPT_KEY_LEN = 64;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, SCRYPT_KEY_LEN).toString('hex');
  return { salt: actualSalt, hash: derived };
}

export function safeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyHashedPassword(
  password: string,
  salt: string,
  expectedHashHex: string
): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LEN);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export interface SessionTokenPayload {
  sub: string;
  jti: string;
  exp: number;
}

export function signSessionToken(
  username: string,
  signingSecret: string,
  nowMs: number = Date.now()
): { token: string; jti: string; exp: number } {
  const jti = crypto.randomBytes(12).toString('hex');
  const exp = nowMs + TOKEN_TTL_MS;
  const payload: SessionTokenPayload = { sub: username, jti, exp };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', signingSecret)
    .update(encoded)
    .digest('base64url');
  return { token: `${encoded}.${sig}`, jti, exp };
}

export function verifySessionToken(
  token: string,
  signingSecret: string,
  revokedJtis: Set<string>,
  nowMs: number = Date.now()
): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(encoded)
    .digest('base64url');

  const sigBufA = Buffer.from(providedSig, 'utf8');
  const sigBufB = Buffer.from(expectedSig, 'utf8');
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }
    if (decoded.exp <= nowMs) return null;
    if (revokedJtis.has(decoded.jti)) return null;
    return decoded;
  } catch {
    return null;
  }
}

const SAFE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_LOGO_DATA_URL_LENGTH = 350_000; // ~250KB binary cap

export function sanitizeCustomLogoUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.trim() === '') return undefined;
  const trimmed = url.trim();
  if (trimmed.length > MAX_LOGO_DATA_URL_LENGTH) return undefined;
  if (!SAFE_IMAGE_DATA_URL_REGEX.test(trimmed)) return undefined;
  return trimmed;
}

export function validateAndSanitizeSeason(input: unknown): Season | null {
  if (typeof input !== 'object' || input === null) return null;
  const s = input as Season;

  if (
    typeof s.id !== 'string' ||
    s.id.trim().length === 0 ||
    s.id.length > 80 ||
    typeof s.name !== 'string' ||
    s.name.trim().length === 0 ||
    s.name.length > 100 ||
    (s.format !== 'once' && s.format !== 'home-away') ||
    (s.status !== 'active' && s.status !== 'completed') ||
    !Array.isArray(s.teams) ||
    s.teams.length !== 6 ||
    !Array.isArray(s.matches) ||
    s.matches.length > 120 ||
    typeof s.knockout !== 'object' ||
    s.knockout === null ||
    !s.knockout.sf1 ||
    !s.knockout.sf2 ||
    !s.knockout.final
  ) {
    return null;
  }

  const sanitizedTeams = s.teams.map((t) => ({
    id: String(t.id).slice(0, 60),
    name: String(t.name).trim().slice(0, 60),
    shortName: String(t.shortName || 'CLB').trim().toUpperCase().slice(0, 4),
    logoId: String(t.logoId || 'real-madrid').slice(0, 40),
    customLogoUrl: sanitizeCustomLogoUrl(t.customLogoUrl),
  }));

  if (sanitizedTeams.some((t) => t.name.length === 0 || t.id.length === 0)) {
    return null;
  }

  return {
    ...s,
    id: s.id.trim(),
    name: s.name.trim(),
    teams: sanitizedTeams,
  };
}
