import type { Season } from '../types/league';

export interface AuthStatusResponse {
  configured: boolean;
  source: 'env' | 'claimed' | 'unclaimed';
}

export interface AuthLoginResponse {
  token: string;
  username: string;
}

async function parseJsonSafe<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const res = await fetch('/api/auth/status');
  if (!res.ok) {
    throw new Error('Could not check admin login status.');
  }
  return parseJsonSafe<AuthStatusResponse>(res);
}

export async function setupAdminAccount(
  username: string,
  password: string
): Promise<AuthLoginResponse> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe<AuthLoginResponse>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Could not set up admin account.');
  }
  return data;
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<AuthLoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseJsonSafe<AuthLoginResponse>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Invalid username or password.');
  }
  return data;
}

export async function logoutAdmin(token: string): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function fetchSeasons(): Promise<Season[]> {
  const res = await fetch('/api/seasons');
  if (!res.ok) {
    throw new Error('Could not load league data from server.');
  }
  const data = await parseJsonSafe<{ seasons: Season[] }>(res);
  return Array.isArray(data.seasons) ? data.seasons : [];
}

export async function createSeasonOnServer(
  season: Season,
  token: string
): Promise<Season[]> {
  const res = await fetch('/api/seasons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ season }),
  });
  const data = await parseJsonSafe<{ seasons: Season[] }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Could not create season.');
  }
  return data.seasons;
}

export async function saveSeasonOnServer(
  season: Season,
  token: string
): Promise<Season[]> {
  const res = await fetch(`/api/seasons/${encodeURIComponent(season.id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ season }),
  });
  const data = await parseJsonSafe<{ seasons: Season[] }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Could not save season changes.');
  }
  return data.seasons;
}

export async function importSeasonsOnServer(
  seasons: Season[],
  token: string
): Promise<Season[]> {
  const res = await fetch('/api/seasons/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ seasons }),
  });
  const data = await parseJsonSafe<{ seasons: Season[] }>(res);
  if (!res.ok) {
    throw new Error(data.error || 'Could not import backup.');
  }
  return data.seasons;
}
