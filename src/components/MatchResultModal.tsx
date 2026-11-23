import React, { useEffect, useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import type { GoalEvent, Team } from '../types/league';
import { ClubLogo } from '../data/clubLogos';
import { createId } from '../utils/leagueEngine';

interface MatchResultModalProps {
  title: string;
  subtitle?: string;
  homeTeam: Team;
  awayTeam: Team;
  initialHomeScore: number | null;
  initialAwayScore: number | null;
  initialHomePenalties?: number | null;
  initialAwayPenalties?: number | null;
  initialGoals: GoalEvent[];
  initialPlayedAt?: string;
  initialNote?: string;
  isKnockout?: boolean;
  homeRoster: string[];
  awayRoster: string[];
  onClose: () => void;
  onSave: (payload: {
    homeScore: number;
    awayScore: number;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    goals: GoalEvent[];
    playedAt: string;
    note?: string;
  }) => void;
  onClearResult?: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  title,
  subtitle,
  homeTeam,
  awayTeam,
  initialHomeScore,
  initialAwayScore,
  initialHomePenalties = null,
  initialAwayPenalties = null,
  initialGoals,
  initialPlayedAt,
  initialNote = '',
  isKnockout = false,
  homeRoster,
  awayRoster,
  onClose,
  onSave,
  onClearResult,
}) => {
  const [homeScore, setHomeScore] = useState<number>(initialHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState<number>(initialAwayScore ?? 0);
  const [homePens, setHomePens] = useState<number>(initialHomePenalties ?? 5);
  const [awayPens, setAwayPens] = useState<number>(initialAwayPenalties ?? 4);
  const [playedAt, setPlayedAt] = useState<string>(
    initialPlayedAt ?? new Date().toISOString().slice(0, 10)
  );
  const [note, setNote] = useState<string>(initialNote);
  const [goals, setGoals] = useState<GoalEvent[]>(() =>
    initialGoals.map((g) => ({ ...g }))
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isDrawKnockout = isKnockout && homeScore === awayScore;

  const homeGoalRows = goals.filter((g) => g.teamId === homeTeam.id);
  const awayGoalRows = goals.filter((g) => g.teamId === awayTeam.id);

  const addGoalRow = (teamId: string) => {
    setGoals((prev) => [
      ...prev,
      { id: createId('goal'), teamId, scorer: '', assist: '', minute: undefined },
    ]);
  };

  const updateGoalRow = (
    id: string,
    field: 'scorer' | 'assist' | 'minute',
    value: string
  ) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g;
        if (field === 'minute') {
          const parsed = value === '' ? undefined : Math.max(1, Math.min(130, Number(value)));
          return { ...g, minute: Number.isNaN(parsed) ? undefined : parsed };
        }
        return { ...g, [field]: value };
      })
    );
  };

  const removeGoalRow = (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const syncGoalRowsToScore = (teamId: string, targetScore: number) => {
    setGoals((prev) => {
      const others = prev.filter((g) => g.teamId !== teamId);
      const current = prev.filter((g) => g.teamId === teamId);
      if (current.length < targetScore) {
        const toAdd = Array.from({ length: targetScore - current.length }).map(() => ({
          id: createId('goal'),
          teamId,
          scorer: '',
          assist: '',
        }));
        return [...others, ...current, ...toAdd];
      }
      return [...others, ...current.slice(0, targetScore)];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isDrawKnockout && homePens === awayPens) {
      setError('Penalty shootout scores cannot be equal — please set a winner.');
      return;
    }

    const cleanedGoals = goals
      .map((g) => ({
        ...g,
        scorer: g.scorer.trim(),
        assist: g.assist?.trim() || undefined,
      }))
      .filter((g) => g.scorer.length > 0);

    onSave({
      homeScore,
      awayScore,
      homePenalties: isDrawKnockout ? homePens : null,
      awayPenalties: isDrawKnockout ? awayPens : null,
      goals: cleanedGoals,
      playedAt,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#2A2F3A] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-[#ECEFF4] dark:border-[#262A32] bg-white dark:bg-[#171A1F] flex items-center justify-between gap-4">
          <div>
            <h2
              id="match-modal-title"
              className="text-base font-bold text-[#111318] dark:text-white"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close match result modal"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#111318] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#232832] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Scoreboard Control */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 p-4 rounded-xl bg-[#F8F9FB] dark:bg-[#12151A] border border-[#ECEFF4] dark:border-[#242933]">
            {/* Home */}
            <div className="flex flex-col items-center gap-2.5">
              <ClubLogo
                logoId={homeTeam.logoId}
                customLogoUrl={homeTeam.customLogoUrl}
                teamName={homeTeam.name}
                size={44}
              />
              <span className="text-sm font-bold text-[#111318] dark:text-white text-center">
                {homeTeam.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${homeTeam.name} score`}
                  onClick={() => setHomeScore((s) => Math.max(0, s - 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-[#1D212A] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#262C38]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={30}
                  aria-label={`${homeTeam.name} goals`}
                  value={homeScore}
                  onChange={(e) => setHomeScore(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 h-9 text-center font-mono-num text-lg font-bold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white"
                />
                <button
                  type="button"
                  aria-label={`Increase ${homeTeam.name} score`}
                  onClick={() => setHomeScore((s) => Math.min(30, s + 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-[#1D212A] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#262C38]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-center font-mono-num text-sm font-semibold text-[#64748B]">
              VS
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-2.5">
              <ClubLogo
                logoId={awayTeam.logoId}
                customLogoUrl={awayTeam.customLogoUrl}
                teamName={awayTeam.name}
                size={44}
              />
              <span className="text-sm font-bold text-[#111318] dark:text-white text-center">
                {awayTeam.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${awayTeam.name} score`}
                  onClick={() => setAwayScore((s) => Math.max(0, s - 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-[#1D212A] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#262C38]"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={30}
                  aria-label={`${awayTeam.name} goals`}
                  value={awayScore}
                  onChange={(e) => setAwayScore(Math.max(0, Number(e.target.value) || 0))}
                  className="w-14 h-9 text-center font-mono-num text-lg font-bold rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white"
                />
                <button
                  type="button"
                  aria-label={`Increase ${awayTeam.name} score`}
                  onClick={() => setAwayScore((s) => Math.min(30, s + 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-white dark:bg-[#1D212A] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#262C38]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Knockout Penalty Tie-Breaker */}
          {isDrawKnockout && (
            <div className="p-4 rounded-xl bg-[#FEF3C7]/40 dark:bg-[#F59E0B]/10 border border-[#F59E0B]/30 space-y-3">
              <div className="text-xs font-semibold text-[#B45309] dark:text-[#FBBF24]">
                Penalty Shootout Required (ပင်နယ်တီအဆုံးအဖြတ်)
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="home-pens"
                    className="block text-xs font-medium text-[#475569] dark:text-[#CBD5E1] mb-1"
                  >
                    {homeTeam.name} Pens
                  </label>
                  <input
                    id="home-pens"
                    type="number"
                    min={0}
                    max={25}
                    value={homePens}
                    onChange={(e) => setHomePens(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-9 px-3 font-mono-num text-sm rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="away-pens"
                    className="block text-xs font-medium text-[#475569] dark:text-[#CBD5E1] mb-1"
                  >
                    {awayTeam.name} Pens
                  </label>
                  <input
                    id="away-pens"
                    type="number"
                    min={0}
                    max={25}
                    value={awayPens}
                    onChange={(e) => setAwayPens(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full h-9 px-3 font-mono-num text-sm rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#303642] text-[#111318] dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Goal Scorers & Assists Entry */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#111318] dark:text-white">
                Goal Scorers &amp; Assists (ဂိုးသွင်းသူ &amp; Assist)
              </h3>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Auto-feeds Top Scorers &amp; Top Assists tables
              </span>
            </div>

            <datalist id="home-roster-list">
              {homeRoster.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="away-roster-list">
              {awayRoster.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Home Scorers */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111318] dark:text-[#E2E8F0]">
                  <ClubLogo
                    logoId={homeTeam.logoId}
                    customLogoUrl={homeTeam.customLogoUrl}
                    teamName={homeTeam.name}
                    size={18}
                  />
                  <span>
                    {homeTeam.name} ({homeGoalRows.length}/{homeScore} goals)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {homeScore > 0 && homeGoalRows.length !== homeScore && (
                    <button
                      type="button"
                      onClick={() => syncGoalRowsToScore(homeTeam.id, homeScore)}
                      className="text-xs font-medium text-[#16A34A] hover:underline"
                    >
                      Match {homeScore} {homeScore === 1 ? 'row' : 'rows'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => addGoalRow(homeTeam.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#F1F5F9] dark:bg-[#232832] text-[#111318] dark:text-white hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Goal</span>
                  </button>
                </div>
              </div>

              {homeGoalRows.map((g, idx) => (
                <div key={g.id} className="grid grid-cols-[1fr_1fr_72px_36px] gap-2">
                  <input
                    type="text"
                    list="home-roster-list"
                    placeholder={`Scorer #${idx + 1} (ဂိုးသွင်းသူ)`}
                    aria-label={`${homeTeam.name} scorer ${idx + 1}`}
                    value={g.scorer}
                    onChange={(e) => updateGoalRow(g.id, 'scorer', e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <input
                    type="text"
                    list="home-roster-list"
                    placeholder="Assist (optional)"
                    aria-label={`${homeTeam.name} assist ${idx + 1}`}
                    value={g.assist ?? ''}
                    onChange={(e) => updateGoalRow(g.id, 'assist', e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Min'"
                    aria-label={`${homeTeam.name} goal minute ${idx + 1}`}
                    value={g.minute ?? ''}
                    onChange={(e) => updateGoalRow(g.id, 'minute', e.target.value)}
                    className="h-9 px-2 text-xs font-mono-num text-center rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => removeGoalRow(g.id)}
                    aria-label={`Remove ${homeTeam.name} goal ${idx + 1}`}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#DC2626]/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Away Scorers */}
            <div className="space-y-2.5 pt-2 border-t border-[#ECEFF4] dark:border-[#242933]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#111318] dark:text-[#E2E8F0]">
                  <ClubLogo
                    logoId={awayTeam.logoId}
                    customLogoUrl={awayTeam.customLogoUrl}
                    teamName={awayTeam.name}
                    size={18}
                  />
                  <span>
                    {awayTeam.name} ({awayGoalRows.length}/{awayScore} goals)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {awayScore > 0 && awayGoalRows.length !== awayScore && (
                    <button
                      type="button"
                      onClick={() => syncGoalRowsToScore(awayTeam.id, awayScore)}
                      className="text-xs font-medium text-[#16A34A] hover:underline"
                    >
                      Match {awayScore} {awayScore === 1 ? 'row' : 'rows'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => addGoalRow(awayTeam.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#F1F5F9] dark:bg-[#232832] text-[#111318] dark:text-white hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Goal</span>
                  </button>
                </div>
              </div>

              {awayGoalRows.map((g, idx) => (
                <div key={g.id} className="grid grid-cols-[1fr_1fr_72px_36px] gap-2">
                  <input
                    type="text"
                    list="away-roster-list"
                    placeholder={`Scorer #${idx + 1} (ဂိုးသွင်းသူ)`}
                    aria-label={`${awayTeam.name} scorer ${idx + 1}`}
                    value={g.scorer}
                    onChange={(e) => updateGoalRow(g.id, 'scorer', e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <input
                    type="text"
                    list="away-roster-list"
                    placeholder="Assist (optional)"
                    aria-label={`${awayTeam.name} assist ${idx + 1}`}
                    value={g.assist ?? ''}
                    onChange={(e) => updateGoalRow(g.id, 'assist', e.target.value)}
                    className="h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Min'"
                    aria-label={`${awayTeam.name} goal minute ${idx + 1}`}
                    value={g.minute ?? ''}
                    onChange={(e) => updateGoalRow(g.id, 'minute', e.target.value)}
                    className="h-9 px-2 text-xs font-mono-num text-center rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <button
                    type="button"
                    onClick={() => removeGoalRow(g.id)}
                    aria-label={`Remove ${awayTeam.name} goal ${idx + 1}`}
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] dark:hover:bg-[#DC2626]/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Match Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#ECEFF4] dark:border-[#242933]">
            <div>
              <label
                htmlFor="match-date"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
              >
                Match Date
              </label>
              <input
                id="match-date"
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono-num rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
              />
            </div>
            {!isKnockout && (
              <div>
                <label
                  htmlFor="match-note"
                  className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
                >
                  Note (Optional)
                </label>
                <input
                  id="match-note"
                  type="text"
                  placeholder="e.g. Evening pitch, rainy match"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
              {error}
            </p>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#ECEFF4] dark:border-[#262A32]">
            <div>
              {onClearResult && initialHomeScore !== null && (
                <button
                  type="button"
                  onClick={onClearResult}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2] dark:hover:bg-[#DC2626]/15 transition-colors"
                >
                  Reset to Unplayed
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
              >
                Save Result
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
