import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { PrePlayedMatchInput, Season } from '../types/league';
import { ClubLogo } from '../data/clubLogos';
import { getKnownTeamPlayers } from '../utils/leagueEngine';

interface RecordPastMatchModalProps {
  season: Season;
  onClose: () => void;
  onSave: (input: PrePlayedMatchInput) => void;
}

interface DraftGoal {
  key: string;
  teamId: string;
  scorer: string;
  assist: string;
  minute: string;
}

export const RecordPastMatchModal: React.FC<RecordPastMatchModalProps> = ({
  season,
  onClose,
  onSave,
}) => {
  const [homeTeamId, setHomeTeamId] = useState<string>(season.teams[0]?.id ?? '');
  const [awayTeamId, setAwayTeamId] = useState<string>(season.teams[1]?.id ?? '');
  const [homeScore, setHomeScore] = useState<number>(2);
  const [awayScore, setAwayScore] = useState<number>(1);
  const [playedAt, setPlayedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState<string>('Played offline before schedule');
  const [goals, setGoals] = useState<DraftGoal[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const homeTeam = season.teams.find((t) => t.id === homeTeamId);
  const awayTeam = season.teams.find((t) => t.id === awayTeamId);

  const matchingSlot = useMemo(() => {
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return null;
    return (
      season.matches.find(
        (m) =>
          m.status === 'scheduled' &&
          m.homeTeamId === homeTeamId &&
          m.awayTeamId === awayTeamId
      ) ??
      season.matches.find(
        (m) =>
          m.status === 'scheduled' &&
          m.homeTeamId === awayTeamId &&
          m.awayTeamId === homeTeamId
      ) ??
      null
    );
  }, [season.matches, homeTeamId, awayTeamId]);

  const homeRoster = useMemo(
    () => (homeTeamId ? getKnownTeamPlayers(season, homeTeamId) : []),
    [season, homeTeamId]
  );
  const awayRoster = useMemo(
    () => (awayTeamId ? getKnownTeamPlayers(season, awayTeamId) : []),
    [season, awayTeamId]
  );

  const addGoal = (teamId: string) => {
    setGoals((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        teamId,
        scorer: '',
        assist: '',
        minute: '',
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      setError('Please select two different teams.');
      return;
    }

    onSave({
      homeTeamId,
      awayTeamId,
      homeScore,
      awayScore,
      playedAt,
      note: note.trim() || undefined,
      goals: goals
        .filter((g) => g.scorer.trim().length > 0)
        .map((g) => ({
          teamId: g.teamId,
          scorer: g.scorer.trim(),
          assist: g.assist.trim() || undefined,
          minute: g.minute ? Number(g.minute) : undefined,
        })),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="past-match-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#2A2F3A] rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-[#ECEFF4] dark:border-[#262A32] bg-white dark:bg-[#171A1F] flex items-center justify-between gap-4">
          <div>
            <h2
              id="past-match-title"
              className="text-base font-bold text-[#111318] dark:text-white"
            >
              Record Past Match (အရင်ကန်ပြီးသားပွဲ ထည့်ရန်)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Auto-syncs into your season schedule &amp; updates standings immediately
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record past match modal"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#111318] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#232832]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Team Selectors + Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="past-home-team"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8]"
              >
                Home Team
              </label>
              <div className="flex items-center gap-2">
                {homeTeam && (
                  <ClubLogo
                    logoId={homeTeam.logoId}
                    customLogoUrl={homeTeam.customLogoUrl}
                    teamName={homeTeam.name}
                    size={28}
                  />
                )}
                <select
                  id="past-home-team"
                  value={homeTeamId}
                  onChange={(e) => {
                    setHomeTeamId(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 h-9 px-3 text-xs font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                >
                  {season.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="past-home-score"
                  className="block text-xs text-[#64748B] dark:text-[#94A3B8] mb-1"
                >
                  Home Goals
                </label>
                <input
                  id="past-home-score"
                  type="number"
                  min={0}
                  max={30}
                  value={homeScore}
                  onChange={(e) => setHomeScore(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full h-9 px-3 font-mono-num text-sm font-bold rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="past-away-team"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8]"
              >
                Away Team
              </label>
              <div className="flex items-center gap-2">
                {awayTeam && (
                  <ClubLogo
                    logoId={awayTeam.logoId}
                    customLogoUrl={awayTeam.customLogoUrl}
                    teamName={awayTeam.name}
                    size={28}
                  />
                )}
                <select
                  id="past-away-team"
                  value={awayTeamId}
                  onChange={(e) => {
                    setAwayTeamId(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 h-9 px-3 text-xs font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                >
                  {season.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="past-away-score"
                  className="block text-xs text-[#64748B] dark:text-[#94A3B8] mb-1"
                >
                  Away Goals
                </label>
                <input
                  id="past-away-score"
                  type="number"
                  min={0}
                  max={30}
                  value={awayScore}
                  onChange={(e) => setAwayScore(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full h-9 px-3 font-mono-num text-sm font-bold rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Smart Auto-Sync Preview */}
          {homeTeamId !== awayTeamId && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#E2E5EC] dark:border-[#262A32] text-xs text-[#475569] dark:text-[#CBD5E1]">
              {matchingSlot ? (
                <span>
                  Auto-sync: Matches scheduled{' '}
                  <strong className="text-[#15803D] dark:text-[#22C55E]">
                    Matchday {matchingSlot.round}
                  </strong>{' '}
                  fixture — will complete that fixture with no duplicate created.
                </span>
              ) : (
                <span>
                  All scheduled fixtures between these two teams are already played. Saving will
                  record this as an additional past match in standings.
                </span>
              )}
            </div>
          )}

          {/* Optional Goal Scorers & Assists */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#111318] dark:text-white">
                Goal Scorers &amp; Assists (Optional)
              </span>
              <div className="flex items-center gap-2">
                {homeTeam && (
                  <button
                    type="button"
                    onClick={() => addGoal(homeTeam.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#F1F5F9] dark:bg-[#232832] text-[#111318] dark:text-white hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{homeTeam.shortName} Goal</span>
                  </button>
                )}
                {awayTeam && (
                  <button
                    type="button"
                    onClick={() => addGoal(awayTeam.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#F1F5F9] dark:bg-[#232832] text-[#111318] dark:text-white hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{awayTeam.shortName} Goal</span>
                  </button>
                )}
              </div>
            </div>

            <datalist id="past-home-roster">
              {homeRoster.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <datalist id="past-away-roster">
              {awayRoster.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>

            {goals.map((g, idx) => {
              const isHome = g.teamId === homeTeamId;
              const teamLabel = isHome ? homeTeam?.shortName : awayTeam?.shortName;
              return (
                <div key={g.key} className="grid grid-cols-[54px_1fr_1fr_36px] gap-2 items-center">
                  <span className="text-[11px] font-mono-num font-bold text-[#64748B] dark:text-[#94A3B8] text-center">
                    {teamLabel}
                  </span>
                  <input
                    type="text"
                    list={isHome ? 'past-home-roster' : 'past-away-roster'}
                    placeholder="Scorer name"
                    aria-label={`Goal ${idx + 1} scorer`}
                    value={g.scorer}
                    onChange={(e) =>
                      setGoals((prev) =>
                        prev.map((row) =>
                          row.key === g.key ? { ...row, scorer: e.target.value } : row
                        )
                      )
                    }
                    className="h-9 px-2.5 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                  />
                  <input
                    type="text"
                    list={isHome ? 'past-home-roster' : 'past-away-roster'}
                    placeholder="Assist (optional)"
                    aria-label={`Goal ${idx + 1} assist`}
                    value={g.assist}
                    onChange={(e) =>
                      setGoals((prev) =>
                        prev.map((row) =>
                          row.key === g.key ? { ...row, assist: e.target.value } : row
                        )
                      )
                    }
                    className="h-9 px-2.5 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setGoals((prev) => prev.filter((row) => row.key !== g.key))}
                    aria-label={`Remove goal ${idx + 1}`}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="past-date"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1"
              >
                Played Date
              </label>
              <input
                id="past-date"
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono-num rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="past-note"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1"
              >
                Note
              </label>
              <input
                id="past-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#ECEFF4] dark:border-[#262A32]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
            >
              Add to Standings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
