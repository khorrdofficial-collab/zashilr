import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Season } from './src/types/league.ts';
import {
  hashPassword,
  safeEqualStrings,
  signSessionToken,
  validateAndSanitizeSeason,
  verifyHashedPassword,
  verifySessionToken,
  type StoredAdminCredential,
} from './src/utils/serverAuth.ts';

interface LeagueDb {
  seasons: Season[];
  adminCredential: StoredAdminCredential | null;
}

function resolveWritableDataDir(): string {
  const preferred = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.resolve(os.tmpdir(), 'zashilaa-league-data');
    if (!fs.existsSync(fallback)) {
      fs.mkdirSync(fallback, { recursive: true });
    }
    return fallback;
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.resolve(DATA_DIR, 'league-db.json');

if (!DB_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database file path outside data directory');
}

const SIGNING_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const revokedJtis = new Set<string>();

// Simple sliding-window rate limiter for login attempts per IP
const loginAttempts = new Map<string, number[]>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 15;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) ?? []).filter((ts) => now - ts < LOGIN_WINDOW_MS);
  loginAttempts.set(ip, recent);
  return recent.length >= LOGIN_MAX_ATTEMPTS;
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const recent = (loginAttempts.get(ip) ?? []).filter((ts) => now - ts < LOGIN_WINDOW_MS);
  recent.push(now);
  loginAttempts.set(ip, recent);
}

function clearFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDb(): LeagueDb {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const empty: LeagueDb = { seasons: [], adminCredential: null };
    writeDb(empty);
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LeagueDb>;
    return {
      seasons: Array.isArray(parsed.seasons) ? parsed.seasons : [],
      adminCredential: parsed.adminCredential ?? null,
    };
  } catch {
    return { seasons: [], adminCredential: null };
  }
}

function writeDb(db: LeagueDb): void {
  ensureDataDir();
  const tmpFile = path.resolve(DATA_DIR, `league-db.${crypto.randomBytes(6).toString('hex')}.tmp`);
  if (!tmpFile.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid temporary file path');
  }
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpFile, DB_FILE);
}

function getEnvAdminConfig(): { username: string; password: string } | null {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (!envPass) return null;
  const envUser = process.env.ADMIN_USERNAME?.trim() || 'admin';
  return { username: envUser, password: envPass };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

interface AuthenticatedRequest extends Request {
  adminUser?: { username: string; jti: string };
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Admin sign-in required to modify league data.' });
    return;
  }
  const verified = verifySessionToken(token, SIGNING_SECRET, revokedJtis);
  if (!verified) {
    res.status(401).json({ error: 'Admin session expired or invalid. Please log in again.' });
    return;
  }
  req.adminUser = { username: verified.sub, jti: verified.jti };
  next();
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4mb' }));

  // --- Auth Endpoints ---

  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const envAdmin = getEnvAdminConfig();
    if (envAdmin) {
      res.json({ configured: true, source: 'env' });
      return;
    }
    const db = readDb();
    if (db.adminCredential) {
      res.json({ configured: true, source: 'claimed' });
      return;
    }
    res.json({ configured: false, source: 'unclaimed' });
  });

  app.post('/api/auth/setup', (req: Request, res: Response) => {
    if (getEnvAdminConfig()) {
      res.status(409).json({
        error: 'Admin credentials are already configured via environment secrets.',
      });
      return;
    }

    const db = readDb();
    if (db.adminCredential) {
      res.status(409).json({
        error: 'Admin account has already been claimed. Please sign in with your credentials.',
      });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (username.length < 2 || username.length > 40) {
      res.status(400).json({ error: 'Username must be between 2 and 40 characters.' });
      return;
    }
    if (password.length < 4 || password.length > 128) {
      res.status(400).json({ error: 'Password must be at least 4 characters.' });
      return;
    }

    const { salt, hash } = hashPassword(password);
    db.adminCredential = {
      username,
      passwordSalt: salt,
      passwordHash: hash,
      claimedAt: new Date().toISOString(),
    };
    writeDb(db);

    const { token } = signSessionToken(username, SIGNING_SECRET);
    res.status(201).json({ token, username });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const clientIp = req.ip || 'unknown';
    if (isRateLimited(clientIp)) {
      res.status(429).json({
        error: 'Too many failed login attempts. Please wait a few minutes and try again.',
      });
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Please enter both username and password.' });
      return;
    }

    const envAdmin = getEnvAdminConfig();
    if (envAdmin) {
      const userMatches = safeEqualStrings(username.toLowerCase(), envAdmin.username.toLowerCase());
      const passMatches = safeEqualStrings(password, envAdmin.password);
      if (!userMatches || !passMatches) {
        recordFailedLogin(clientIp);
        res.status(401).json({ error: 'Invalid admin username or password.' });
        return;
      }
      clearFailedLogins(clientIp);
      const { token } = signSessionToken(envAdmin.username, SIGNING_SECRET);
      res.json({ token, username: envAdmin.username });
      return;
    }

    const db = readDb();
    if (!db.adminCredential) {
      res.status(409).json({
        error: 'Admin account is not set up yet. Complete first-time admin setup first.',
      });
      return;
    }

    const userMatches = safeEqualStrings(
      username.toLowerCase(),
      db.adminCredential.username.toLowerCase()
    );
    const passMatches = verifyHashedPassword(
      password,
      db.adminCredential.passwordSalt,
      db.adminCredential.passwordHash
    );

    if (!userMatches || !passMatches) {
      recordFailedLogin(clientIp);
      res.status(401).json({ error: 'Invalid admin username or password.' });
      return;
    }

    clearFailedLogins(clientIp);
    const { token } = signSessionToken(db.adminCredential.username, SIGNING_SECRET);
    res.json({ token, username: db.adminCredential.username });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) {
      const verified = verifySessionToken(token, SIGNING_SECRET, revokedJtis);
      if (verified) {
        revokedJtis.add(verified.jti);
      }
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    res.json({ authenticated: true, username: req.adminUser?.username });
  });

  // --- Public Read-Only & Admin-Protected League Data Endpoints ---

  app.get('/api/seasons', (_req: Request, res: Response) => {
    const db = readDb();
    res.json({ seasons: db.seasons });
  });

  app.post('/api/seasons', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const sanitized = validateAndSanitizeSeason(req.body?.season);
    if (!sanitized) {
      res.status(400).json({ error: 'Invalid season payload. Exactly 6 named teams are required.' });
      return;
    }
    const db = readDb();
    if (db.seasons.some((s) => s.id === sanitized.id)) {
      res.status(409).json({ error: 'A season with this ID already exists.' });
      return;
    }
    db.seasons = [sanitized, ...db.seasons];
    writeDb(db);
    res.status(201).json({ season: sanitized, seasons: db.seasons });
  });

  app.put('/api/seasons/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const seasonId = String(req.params.id || '').trim();
    const sanitized = validateAndSanitizeSeason(req.body?.season);
    if (!sanitized || sanitized.id !== seasonId) {
      res.status(400).json({ error: 'Invalid season update payload.' });
      return;
    }
    const db = readDb();
    const idx = db.seasons.findIndex((s) => s.id === seasonId);
    if (idx === -1) {
      res.status(404).json({ error: 'Season not found.' });
      return;
    }
    db.seasons[idx] = sanitized;
    writeDb(db);
    res.json({ season: sanitized, seasons: db.seasons });
  });

  app.delete('/api/seasons/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const seasonId = String(req.params.id || '').trim();
    const db = readDb();
    const next = db.seasons.filter((s) => s.id !== seasonId);
    if (next.length === db.seasons.length) {
      res.status(404).json({ error: 'Season not found.' });
      return;
    }
    db.seasons = next;
    writeDb(db);
    res.json({ seasons: db.seasons });
  });

  app.post('/api/seasons/import', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const rawList = req.body?.seasons;
    if (!Array.isArray(rawList) || rawList.length === 0 || rawList.length > 50) {
      res.status(400).json({ error: 'Invalid backup payload.' });
      return;
    }
    const sanitizedList: Season[] = [];
    for (const item of rawList) {
      const clean = validateAndSanitizeSeason(item);
      if (!clean) {
        res.status(400).json({ error: 'Backup contains an invalid season entry.' });
        return;
      }
      sanitizedList.push(clean);
    }
    const db = readDb();
    db.seasons = sanitizedList;
    writeDb(db);
    res.json({ seasons: db.seasons });
  });

  // Fast health check endpoint for Cloud Run startup/liveness probes
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  // --- Frontend Serving (Vite dev middleware vs production dist) ---

  const distPath = path.resolve(process.cwd(), 'dist');
  const hasBuiltDist = fs.existsSync(path.resolve(distPath, 'index.html'));
  const isDev =
    process.env.APP_DEV_MODE === '1' ||
    (process.env.NODE_ENV !== 'production' && !hasBuiltDist);

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.resolve(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server listening on http://0.0.0.0:${PORT} (${isDev ? 'development' : 'production'})`
    );
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
