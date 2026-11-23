import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  History as HistoryIcon,
  Lock,
  LogOut,
  Moon,
  Plus,
  PlusCircle,
  ShieldCheck,
  Sun,
  Target,
  Trophy,
  Upload,
} from 'lucide-react';
import type {
  GoalEvent,
  Match,
  PrePlayedMatchInput,
  ScheduleFormat,
  Season,
  Team,
} from './types/league';
import { ClubLogo } from './data/clubLogos';
import {
  addManualFixtureToSeason,
  arrangeFixtureInSeason,
  calculatePlayerStats,
  calculateStandings,
  createEmptyKnockout,
  createId,
  deleteFixtureFromSeason,
  generateRoundRobinFixtures,
  getKnownTeamPlayers,
  recordPastMatchIntoSeason,
  reshuffleRemainingFixtures,
  syncSeasonKnockout,
  updateKnockoutMatchInSeason,
  updateMatchResultInSeason,
} from './utils/leagueEngine';
import {
  createSeasonOnServer,
  fetchAuthStatus,
  fetchSeasons,
  importSeasonsOnServer,
  logoutAdmin,
  saveSeasonOnServer,
  type AuthStatusResponse,
} from './utils/api';
import { loadTheme, saveTheme, validateImportedSeasons } from './utils/storage';
import { StandingsTable } from './components/StandingsTable';
import { FixturesView } from './components/FixturesView';
import { KnockoutView } from './components/KnockoutView';
import { PlayerStatsView } from './components/PlayerStatsView';
import { HistoryView } from './components/HistoryView';
import { MatchResultModal } from './components/MatchResultModal';
import { RecordPastMatchModal } from './components/RecordPastMatchModal';
import { NewSeasonModal } from './components/NewSeasonModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { ArrangeFixtureModal } from './components/ArrangeFixtureModal';

type NavTab = 'standings' | 'fixtures' | 'knockout' | 'stats' | 'history';

interface AdminSession {
  token: string;
  username: string;
}

export default function App() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Admin session held strictly in React memory (never localStorage/sessionStorage)
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse>({
    configured: false,
    source: 'unclaimed',
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavTab>('standings');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme());
  const [fixtureTeamFilter, setFixtureTeamFilter] = useState<string | null>(null);

  // Modals
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [arrangingMatch, setArrangingMatch] = useState<Match | 'new' | null>(null);
  const [editingKnockoutStage, setEditingKnockoutStage] = useState<
    'sf1' | 'sf2' | 'final' | null
  >(null);
  const [showPastMatchModal, setShowPastMatchModal] = useState<boolean>(false);
  const [showNewSeasonModal, setShowNewSeasonModal] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = adminSession !== null;

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedSeasons, status] = await Promise.all([
        fetchSeasons(),
        fetchAuthStatus(),
      ]);
      setSeasons(loadedSeasons);
      setAuthStatus(status);
      if (loadedSeasons.length > 0) {
        const active = loadedSeasons.find((s) => s.status === 'active') ?? loadedSeasons[0];
        setActiveSeasonId((prev) =>
          loadedSeasons.some((s) => s.id === prev) ? prev : active.id
        );
      } else {
        setActiveSeasonId('');
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to connect to league server.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeSeason = useMemo(
    () => seasons.find((s) => s.id === activeSeasonId) ?? seasons[0] ?? null,
    [seasons, activeSeasonId]
  );

  const standings = useMemo(
    () => (activeSeason ? calculateStandings(activeSeason.teams, activeSeason.matches) : []),
    [activeSeason]
  );

  const { topScorers, topAssists } = useMemo(
    () =>
      activeSeason
        ? calculatePlayerStats([activeSeason], activeSeason.id)
        : { topScorers: [], topAssists: [] },
    [activeSeason]
  );

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    activeSeason?.teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [activeSeason]);

  const upcomingMatches = useMemo(() => {
    if (!activeSeason) return [];
    return activeSeason.matches.filter((m) => m.status === 'scheduled').slice(0, 4);
  }, [activeSeason]);

  const completedCount = useMemo(
    () => activeSeason?.matches.filter((m) => m.status === 'completed').length ?? 0,
    [activeSeason]
  );

  const requireAdminOrPrompt = (): AdminSession | null => {
    if (!adminSession) {
      setShowAuthModal(true);
      return null;
    }
    return adminSession;
  };

  const persistActiveSeasonUpdate = async (
    updater: (season: Season) => Season,
    successMessage: string
  ) => {
    const session = requireAdminOrPrompt();
    if (!session || !activeSeason) return;

    const updatedSeason = updater(activeSeason);
    setSaving(true);
    try {
      const serverSeasons = await saveSeasonOnServer(updatedSeason, session.token);
      setSeasons(serverSeasons);
      setToast(successMessage);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.';
      if (msg.toLowerCase().includes('session') || msg.toLowerCase().includes('sign-in')) {
        setAdminSession(null);
        setShowAuthModal(true);
      }
      setToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMatchResult = async (payload: {
    homeScore: number;
    awayScore: number;
    goals: GoalEvent[];
    playedAt: string;
    note?: string;
  }) => {
    if (!editingMatch) return;
    const matchId = editingMatch.id;
    setEditingMatch(null);
    await persistActiveSeasonUpdate(
      (s) =>
        updateMatchResultInSeason(s, matchId, {
          homeScore: payload.homeScore,
          awayScore: payload.awayScore,
          goals: payload.goals,
          playedAt: payload.playedAt,
          note: payload.note,
        }),
      'Saved match result & updated standings (View-Only locked for guests).'
    );
  };

  const handleClearMatchResult = async () => {
    if (!editingMatch) return;
    const matchId = editingMatch.id;
    setEditingMatch(null);
    await persistActiveSeasonUpdate(
      (s) =>
        updateMatchResultInSeason(s, matchId, {
          homeScore: null,
          awayScore: null,
          goals: [],
        }),
      'Match reset to upcoming.'
    );
  };

  const handleSaveKnockoutResult = async (payload: {
    homeScore: number;
    awayScore: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    goals: GoalEvent[];
    playedAt: string;
  }) => {
    if (!editingKnockoutStage) return;
    const stage = editingKnockoutStage;
    setEditingKnockoutStage(null);
    await persistActiveSeasonUpdate(
      (s) =>
        updateKnockoutMatchInSeason(s, stage, {
          homeScore: payload.homeScore,
          awayScore: payload.awayScore,
          homePenalties: payload.homePenalties,
          awayPenalties: payload.awayPenalties,
          goals: payload.goals,
          playedAt: payload.playedAt,
        }),
      'Knockout score saved.'
    );
  };

  const handleClearKnockoutResult = async () => {
    if (!editingKnockoutStage) return;
    const stage = editingKnockoutStage;
    setEditingKnockoutStage(null);
    await persistActiveSeasonUpdate(
      (s) =>
        updateKnockoutMatchInSeason(s, stage, {
          homeScore: null,
          awayScore: null,
          homePenalties: null,
          awayPenalties: null,
          goals: [],
        }),
      'Knockout tie reset.'
    );
  };

  const handleRecordPastMatch = async (input: PrePlayedMatchInput) => {
    setShowPastMatchModal(false);
    await persistActiveSeasonUpdate(
      (s) => recordPastMatchIntoSeason(s, input),
      'Past match synced & standings saved.'
    );
  };

  const handleReshuffleFixtures = async () => {
    await persistActiveSeasonUpdate(
      (s) => reshuffleRemainingFixtures(s, Date.now()),
      'Remaining unplayed fixtures shuffled and saved.'
    );
  };

  const handleSaveArrangedFixture = async (payload: {
    round: number;
    homeTeamId: string;
    awayTeamId: string;
  }) => {
    const current = arrangingMatch;
    setArrangingMatch(null);
    if (current === 'new') {
      await persistActiveSeasonUpdate(
        (s) => addManualFixtureToSeason(s, payload),
        'Manual fixture added and saved.'
      );
    } else if (current) {
      await persistActiveSeasonUpdate(
        (s) => arrangeFixtureInSeason(s, current.id, payload),
        'Fixture arrangement updated and saved.'
      );
    }
  };

  const handleDeleteArrangedFixture = async () => {
    if (!arrangingMatch || arrangingMatch === 'new') return;
    const targetId = arrangingMatch.id;
    setArrangingMatch(null);
    await persistActiveSeasonUpdate(
      (s) => deleteFixtureFromSeason(s, targetId),
      'Fixture removed and saved.'
    );
  };

  const handleCreateSeason = async (payload: {
    name: string;
    format: ScheduleFormat;
    teams: Team[];
    prePlayedMatches: PrePlayedMatchInput[];
  }) => {
    const session = requireAdminOrPrompt();
    if (!session) return;

    const seasonId = createId('season');
    const { matches, nextCompletedOrder } = generateRoundRobinFixtures(
      payload.teams,
      payload.format,
      payload.prePlayedMatches,
      Date.now()
    );

    const freshSeason = syncSeasonKnockout({
      id: seasonId,
      name: payload.name,
      format: payload.format,
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'active',
      teams: payload.teams,
      matches,
      knockout: createEmptyKnockout(seasonId),
      nextCompletedOrder,
    });

    setSaving(true);
    try {
      const serverSeasons = await createSeasonOnServer(freshSeason, session.token);
      setSeasons(serverSeasons);
      setActiveSeasonId(freshSeason.id);
      setActiveTab('standings');
      setFixtureTeamFilter(null);
      setShowNewSeasonModal(false);
      setToast(
        `Created ${freshSeason.name} with ${freshSeason.matches.length} fixtures (Saved).`
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not create season.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSeason = async () => {
    await persistActiveSeasonUpdate(
      (s) => ({
        ...s,
        status: 'completed',
        completedAt: new Date().toISOString().slice(0, 10),
      }),
      'Season archived to History.'
    );
    setActiveTab('history');
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(seasons, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zashilaa-league-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setToast('League backup downloaded as JSON.');
  };

  const handleImportJson = async (file: File | undefined) => {
    if (!file) return;
    const session = requireAdminOrPrompt();
    if (!session) return;

    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const validated = validateImportedSeasons(parsed);
      if (!validated) {
        setToast('Invalid league backup file.');
        return;
      }
      setSaving(true);
      const serverSeasons = await importSeasonsOnServer(validated, session.token);
      setSeasons(serverSeasons);
      const active = serverSeasons.find((s) => s.status === 'active') ?? serverSeasons[0];
      setActiveSeasonId(active?.id ?? '');
      setToast(`Restored ${serverSeasons.length} seasons to server.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Could not import JSON backup.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (adminSession) {
      await logoutAdmin(adminSession.token);
    }
    setAdminSession(null);
    setEditingMatch(null);
    setArrangingMatch(null);
    setEditingKnockoutStage(null);
    setShowPastMatchModal(false);
    setShowNewSeasonModal(false);
    setToast('Signed out — switched to public View-Only mode.');
  };

  const navItems: Array<{ id: NavTab; label: string }> = [
    { id: 'standings', label: 'Standings' },
    { id: 'fixtures', label: 'Fixtures' },
    { id: 'knockout', label: 'Knockout' },
    { id: 'stats', label: 'Stats' },
    { id: 'history', label: 'History' },
  ];

  const editingKnockoutMatch =
    activeSeason && editingKnockoutStage
      ? activeSeason.knockout[editingKnockoutStage]
      : null;

  const isSeasonEditable = Boolean(isAdmin && activeSeason && activeSeason.status === 'active');

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F7] dark:bg-[#0E1013] text-[#111318] dark:text-[#F3F4F6]">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#14171C]/95 backdrop-blur-sm border-b border-[#E2E5EC] dark:border-[#242831]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('standings')}
            className="text-lg font-extrabold tracking-tight text-[#111318] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded"
          >
            ဇရှိလား
          </button>

          {/* Zone 2: 5 Concise Single-line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 h-full"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'fixtures') setFixtureTeamFilter(null);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-full inline-flex items-center text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#111318] dark:text-white'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#111318] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#16A34A] dark:bg-[#00C853]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Admin Login when guest, New Season when Admin) */}
          <div className="shrink-0">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowNewSeasonModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Season</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Strip (compact single row) */}
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-[#ECEFF4] dark:border-[#22262E] px-4 flex items-center gap-4 overflow-x-auto h-11"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative h-full inline-flex items-center text-xs font-semibold whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#16A34A] dark:text-[#22C55E]'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#16A34A] dark:bg-[#00C853]" />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Workspace Toolbar */}
        <section
          aria-label="Season context and controls"
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2E5EC] dark:border-[#22262E]"
        >
          {activeTab === 'history' ? (
            <div className="space-y-1">
              <h1 className="text-lg font-extrabold tracking-tight text-[#111318] dark:text-white">
                ဇရှိလား Season History (ရာသီမှတ်တမ်းများ)
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span className="font-mono-num">
                  {seasons.filter((s) => s.status === 'completed').length} completed
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{seasons.length} total seasons</span>
                <span aria-hidden="true">·</span>
                <span>
                  {isAdmin
                    ? `Admin: ${adminSession.username}`
                    : 'View-Only Mode (ကြည့်ရှုရန်သာ)'}
                </span>
              </div>
            </div>
          ) : activeSeason ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="season-switcher" className="sr-only">
                  Select Season
                </label>
                <select
                  id="season-switcher"
                  value={activeSeason.id}
                  onChange={(e) => {
                    setActiveSeasonId(e.target.value);
                    setFixtureTeamFilter(null);
                  }}
                  className="h-9 px-3 pr-8 text-sm font-bold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.status === 'completed' ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>

                <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  {isAdmin ? (
                    <span className="inline-flex items-center gap-1 text-[#15803D] dark:text-[#22C55E] font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Admin ({adminSession.username})
                    </span>
                  ) : (
                    'View-Only (ကြည့်ရှုရန်သာ)'
                  )}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>
                  {activeSeason.format === 'home-away'
                    ? 'Home & Away (အိမ်ကွင်း/အဝေးကွင်း)'
                    : 'Single Round-Robin (တစ်ကျော့)'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  {completedCount}/{activeSeason.matches.length} matches played
                </span>
                <span aria-hidden="true">·</span>
                <span>Top 4 Knockout / Bottom 2 Relegated</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h1 className="text-lg font-extrabold tracking-tight text-[#111318] dark:text-white">
                ဇရှိလား League Standings &amp; Fixtures
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>
                  {isAdmin
                    ? `Signed in as Admin (${adminSession.username}) · Ready to add 6 teams`
                    : 'Public View-Only · Waiting for Admin to create Season 1'}
                </span>
              </div>
            </div>
          )}

          {/* Secondary Utility Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {isSeasonEditable && activeTab !== 'history' && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowPastMatchModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-[#F3F4F6] hover:bg-[#F1F5F9] dark:hover:bg-[#1F242D] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
              >
                <HistoryIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Record Past Match</span>
              </button>
            )}

            {seasons.length > 0 && (
              <button
                type="button"
                onClick={handleExportJson}
                title="Download JSON backup of all seasons"
                aria-label="Export league backup JSON"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#475569] dark:text-[#CBD5E1] hover:text-[#111318] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Backup</span>
              </button>
            )}

            {isAdmin && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => importInputRef.current?.click()}
                  title="Restore league backup JSON"
                  aria-label="Import league backup JSON"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#475569] dark:text-[#CBD5E1] hover:text-[#111318] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Restore</span>
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="hidden"
                  onChange={(e) => {
                    void handleImportJson(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  aria-label="Sign out of admin account"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2] dark:hover:bg-[#DC2626]/15 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#475569] dark:text-[#CBD5E1] hover:text-[#111318] dark:hover:text-white transition-colors shrink-0"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </section>

        {/* Loading / Error / Empty States */}
        {loading ? (
          <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-11 rounded-lg bg-[#F1F5F9] dark:bg-[#1E222B] animate-pulse"
              />
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white dark:bg-[#171A1F] border border-[#DC2626]/30 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm font-bold text-[#DC2626] dark:text-[#F87171]">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadInitialData()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
            >
              Retry
            </button>
          </div>
        ) : !activeSeason ? (
          <section className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-2xl p-10 text-center max-w-2xl mx-auto space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#16A34A]/15 text-[#16A34A] dark:text-[#22C55E] flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold text-[#111318] dark:text-white">
                ဇရှိလား Season 1 စတင်ရန် အသင့်ဖြစ်ပါပြီ
              </h2>
              <p className="text-sm text-[#64748B] dark:text-[#94A3B8] max-w-lg mx-auto">
                {isAdmin
                  ? 'Admin အကောင့် ဝင်ရောက်ပြီးပါပြီ။ အသင်း ၆ သင်းကို ကိုယ်တိုင်ထည့်သွင်းပြီး ပွဲစဉ်များနှင့် Standing Table စတင်ဖန်တီးနိုင်ပါသည်။'
                  : 'Admin အကောင့်ဝင်ရောက်ပြီးမှ အသင်း ၆ သင်း ထည့်သွင်းခြင်း၊ ပွဲစဉ်စီစဉ်ခြင်းနှင့် ပွဲရလဒ်များ ထည့်သွင်းနိုင်ပါမည်။ တခြားသူများအတွက် View-Only အနေဖြင့်သာ ကြည့်ရှုနိုင်မည်ဖြစ်ပါသည်။'}
              </p>
            </div>
            <div className="pt-2">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowNewSeasonModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>Create ဇရှိလား Season 1 (အသင်း ၆ သင်း ထည့်ရန်)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
                >
                  <Lock className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {authStatus.configured
                      ? 'Admin Login (အကောင့်ဝင်ရန်)'
                      : 'Set Up Admin Account (Admin အကောင့်စတင်သတ်မှတ်ရန်)'}
                  </span>
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            {/* Active View Content */}
            {activeTab === 'standings' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Primary Focal Anchor: FotMob Standing Table */}
                <div className="xl:col-span-8 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h1 className="text-lg font-extrabold tracking-tight text-[#111318] dark:text-white">
                      {activeSeason.name} · Standings
                    </h1>
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Click a team to inspect its fixtures
                    </span>
                  </div>
                  <StandingsTable
                    standings={standings}
                    onSelectTeam={(teamId) => {
                      setFixtureTeamFilter(teamId);
                      setActiveTab('fixtures');
                    }}
                  />
                </div>

                {/* Companion Rail */}
                <aside className="xl:col-span-4 space-y-5">
                  {/* Next Up Fixtures */}
                  <section className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
                    <header className="px-4 py-3 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between">
                      <h2 className="text-xs font-bold text-[#111318] dark:text-white">
                        Next Fixtures (ကန်ရမည့်ပွဲစဉ်များ)
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('fixtures')}
                        className="text-xs font-semibold text-[#16A34A] dark:text-[#22C55E] hover:underline"
                      >
                        View all
                      </button>
                    </header>

                    {upcomingMatches.length === 0 ? (
                      <div className="p-5 text-center space-y-2">
                        <p className="text-xs font-semibold text-[#111318] dark:text-white">
                          All group fixtures completed!
                        </p>
                        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          Check the Top 4 Knockout bracket to see who wins the championship.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('knockout')}
                          className="mt-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
                        >
                          Open Knockout Bracket
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
                        {upcomingMatches.map((m) => {
                          const home = teamMap.get(m.homeTeamId);
                          const away = teamMap.get(m.awayTeamId);
                          if (!home || !away) return null;
                          return (
                            <div
                              key={m.id}
                              className="px-4 py-3 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 space-y-1.5">
                                <div className="text-[11px] font-mono-num text-[#64748B] dark:text-[#8B95A5]">
                                  Matchday {m.round}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#111318] dark:text-white">
                                  <ClubLogo
                                    logoId={home.logoId}
                                    customLogoUrl={home.customLogoUrl}
                                    teamName={home.name}
                                    size={18}
                                  />
                                  <span className="truncate">{home.name}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold text-[#111318] dark:text-white">
                                  <ClubLogo
                                    logoId={away.logoId}
                                    customLogoUrl={away.customLogoUrl}
                                    teamName={away.name}
                                    size={18}
                                  />
                                  <span className="truncate">{away.name}</span>
                                </div>
                              </div>

                              {isSeasonEditable && (
                                <button
                                  type="button"
                                  onClick={() => setEditingMatch(m)}
                                  aria-label={`Enter result for ${home.name} vs ${away.name}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#16A34A]/12 text-[#15803D] dark:text-[#22C55E] hover:bg-[#16A34A] hover:text-white transition-colors whitespace-nowrap shrink-0"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Score</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Player Stat Leaders Snapshot */}
                  <section className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
                    <header className="px-4 py-3 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between">
                      <h2 className="text-xs font-bold text-[#111318] dark:text-white">
                        Season Leaders (ဂိုးသွင်း &amp; Assist)
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('stats')}
                        className="text-xs font-semibold text-[#16A34A] dark:text-[#22C55E] hover:underline"
                      >
                        Full tables
                      </button>
                    </header>

                    <div className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
                      {/* Top Scorer */}
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                            <Target className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
                            <span>Top Scorer (ဂိုးသွင်းအများဆုံး)</span>
                          </div>
                          {topScorers[0] ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <ClubLogo
                                logoId={topScorers[0].teamLogoId}
                                customLogoUrl={topScorers[0].teamCustomLogoUrl}
                                teamName={topScorers[0].teamName}
                                size={22}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-[#111318] dark:text-white truncate">
                                  {topScorers[0].playerName}
                                </div>
                                <div className="text-[11px] text-[#64748B] dark:text-[#8B95A5] truncate">
                                  {topScorers[0].teamName}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-[#64748B]">No goals logged yet</p>
                          )}
                        </div>
                        {topScorers[0] && (
                          <div className="text-right shrink-0">
                            <div className="font-mono-num text-xl font-extrabold text-[#111318] dark:text-white">
                              {topScorers[0].goals}
                            </div>
                            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                              Goals
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Top Assist */}
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                            <Award className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
                            <span>Top Assist (Assist အများဆုံး)</span>
                          </div>
                          {topAssists[0] ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <ClubLogo
                                logoId={topAssists[0].teamLogoId}
                                customLogoUrl={topAssists[0].teamCustomLogoUrl}
                                teamName={topAssists[0].teamName}
                                size={22}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-[#111318] dark:text-white truncate">
                                  {topAssists[0].playerName}
                                </div>
                                <div className="text-[11px] text-[#64748B] dark:text-[#8B95A5] truncate">
                                  {topAssists[0].teamName}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-[#64748B]">No assists logged yet</p>
                          )}
                        </div>
                        {topAssists[0] && (
                          <div className="text-right shrink-0">
                            <div className="font-mono-num text-xl font-extrabold text-[#111318] dark:text-white">
                              {topAssists[0].assists}
                            </div>
                            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                              Assists
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {activeTab === 'fixtures' && (
              <FixturesView
                season={activeSeason}
                initialTeamFilter={fixtureTeamFilter}
                onEditMatch={(match) => setEditingMatch(match)}
                onArrangeMatch={isSeasonEditable ? (match) => setArrangingMatch(match) : undefined}
                onAddManualFixture={isSeasonEditable ? () => setArrangingMatch('new') : undefined}
                onReshuffleFixtures={() => void handleReshuffleFixtures()}
                onOpenRecordPastMatch={() => setShowPastMatchModal(true)}
                readOnly={!isSeasonEditable}
              />
            )}

            {activeTab === 'knockout' && (
              <KnockoutView
                season={activeSeason}
                standings={standings}
                onEditKnockout={(stage) => setEditingKnockoutStage(stage)}
                onCompleteSeason={isSeasonEditable ? () => void handleCompleteSeason() : undefined}
                readOnly={!isSeasonEditable}
              />
            )}

            {activeTab === 'stats' && (
              <PlayerStatsView seasons={seasons} activeSeason={activeSeason} />
            )}

            {activeTab === 'history' && (
              <HistoryView
                seasons={seasons}
                isAdmin={isAdmin}
                onStartNewSeason={() => setShowNewSeasonModal(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Admin Modals */}
      {showAuthModal && (
        <AdminAuthModal
          authStatus={authStatus}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={(session) => {
            setAdminSession(session);
            setAuthStatus({ configured: true, source: authStatus.source === 'env' ? 'env' : 'claimed' });
            setShowAuthModal(false);
            setToast(`Signed in as Admin (${session.username}).`);
          }}
        />
      )}

      {isSeasonEditable &&
        activeSeason &&
        editingMatch &&
        teamMap.get(editingMatch.homeTeamId) &&
        teamMap.get(editingMatch.awayTeamId) && (
          <MatchResultModal
            title={`Matchday ${editingMatch.round} Result`}
            subtitle={
              editingMatch.isPrePlayed
                ? 'Pre-played offline match · Editing updates standings & player stats'
                : 'Enter final score, goal scorers & assisters'
            }
            homeTeam={teamMap.get(editingMatch.homeTeamId)!}
            awayTeam={teamMap.get(editingMatch.awayTeamId)!}
            initialHomeScore={editingMatch.homeScore}
            initialAwayScore={editingMatch.awayScore}
            initialGoals={editingMatch.goals}
            initialPlayedAt={editingMatch.playedAt}
            initialNote={editingMatch.note}
            homeRoster={getKnownTeamPlayers(activeSeason, editingMatch.homeTeamId)}
            awayRoster={getKnownTeamPlayers(activeSeason, editingMatch.awayTeamId)}
            onClose={() => setEditingMatch(null)}
            onSave={(p) => void handleSaveMatchResult(p)}
            onClearResult={() => void handleClearMatchResult()}
          />
        )}

      {isSeasonEditable && activeSeason && arrangingMatch && (
        <ArrangeFixtureModal
          season={activeSeason}
          match={arrangingMatch === 'new' ? null : arrangingMatch}
          onClose={() => setArrangingMatch(null)}
          onSave={(p) => void handleSaveArrangedFixture(p)}
          onDelete={
            arrangingMatch !== 'new' ? () => void handleDeleteArrangedFixture() : undefined
          }
        />
      )}

      {isSeasonEditable &&
        activeSeason &&
        editingKnockoutStage &&
        editingKnockoutMatch &&
        editingKnockoutMatch.homeTeamId &&
        editingKnockoutMatch.awayTeamId &&
        teamMap.get(editingKnockoutMatch.homeTeamId) &&
        teamMap.get(editingKnockoutMatch.awayTeamId) && (
          <MatchResultModal
            title={editingKnockoutMatch.label}
            subtitle="Knockout tie — draws require a penalty shootout winner"
            homeTeam={teamMap.get(editingKnockoutMatch.homeTeamId)!}
            awayTeam={teamMap.get(editingKnockoutMatch.awayTeamId)!}
            initialHomeScore={editingKnockoutMatch.homeScore}
            initialAwayScore={editingKnockoutMatch.awayScore}
            initialHomePenalties={editingKnockoutMatch.homePenalties}
            initialAwayPenalties={editingKnockoutMatch.awayPenalties}
            initialGoals={editingKnockoutMatch.goals}
            initialPlayedAt={editingKnockoutMatch.playedAt}
            isKnockout
            homeRoster={getKnownTeamPlayers(activeSeason, editingKnockoutMatch.homeTeamId)}
            awayRoster={getKnownTeamPlayers(activeSeason, editingKnockoutMatch.awayTeamId)}
            onClose={() => setEditingKnockoutStage(null)}
            onSave={(p) => void handleSaveKnockoutResult(p)}
            onClearResult={() => void handleClearKnockoutResult()}
          />
        )}

      {isSeasonEditable && activeSeason && showPastMatchModal && (
        <RecordPastMatchModal
          season={activeSeason}
          onClose={() => setShowPastMatchModal(false)}
          onSave={(p) => void handleRecordPastMatch(p)}
        />
      )}

      {isAdmin && showNewSeasonModal && (
        <NewSeasonModal
          defaultSeasonNumber={seasons.length + 1}
          previousTeams={activeSeason?.teams}
          onClose={() => setShowNewSeasonModal(false)}
          onCreate={(p) => void handleCreateSeason(p)}
        />
      )}

      {/* Subtle Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111318] dark:bg-white text-white dark:text-[#111318] text-xs font-semibold shadow-lg border border-white/10 dark:border-black/10"
        >
          <CheckCircle2 className="w-4 h-4 text-[#22C55E] dark:text-[#16A34A] shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
