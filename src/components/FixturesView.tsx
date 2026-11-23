import React, { useMemo, useState } from 'react';
import { Calendar, Edit3, History, Plus, PlusCircle, Shuffle, SlidersHorizontal } from 'lucide-react';
import type { Match, Season, Team } from '../types/league';
import { ClubLogo } from '../data/clubLogos';

interface FixturesViewProps {
  season: Season;
  initialTeamFilter?: string | null;
  onEditMatch: (match: Match) => void;
  onArrangeMatch?: (match: Match) => void;
  onAddManualFixture?: () => void;
  onReshuffleFixtures: () => void;
  onOpenRecordPastMatch: () => void;
  readOnly?: boolean;
}

type FilterMode = 'all' | 'scheduled' | 'completed' | 'preplayed';

export const FixturesView: React.FC<FixturesViewProps> = ({
  season,
  initialTeamFilter = null,
  onEditMatch,
  onArrangeMatch,
  onAddManualFixture,
  onReshuffleFixtures,
  onOpenRecordPastMatch,
  readOnly = false,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [teamFilter, setTeamFilter] = useState<string>(initialTeamFilter ?? 'all');

  React.useEffect(() => {
    setTeamFilter(initialTeamFilter ?? 'all');
  }, [initialTeamFilter]);

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    season.teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [season.teams]);

  const counts = useMemo(() => {
    const total = season.matches.length;
    const completed = season.matches.filter((m) => m.status === 'completed').length;
    const scheduled = total - completed;
    const preplayed = season.matches.filter((m) => m.isPrePlayed).length;
    return { total, completed, scheduled, preplayed };
  }, [season.matches]);

  const filteredMatches = useMemo(() => {
    return season.matches.filter((m) => {
      if (filterMode === 'scheduled' && m.status !== 'scheduled') return false;
      if (filterMode === 'completed' && m.status !== 'completed') return false;
      if (filterMode === 'preplayed' && !m.isPrePlayed) return false;
      if (
        teamFilter !== 'all' &&
        m.homeTeamId !== teamFilter &&
        m.awayTeamId !== teamFilter
      ) {
        return false;
      }
      return true;
    });
  }, [season.matches, filterMode, teamFilter]);

  const groupedByRound = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of filteredMatches) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredMatches]);

  return (
    <div className="space-y-5">
      {/* Toolbar: Filter Tabs + Team Select + Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Filter fixtures by status"
            className="inline-flex items-center p-1 bg-[#E8EBF0] dark:bg-[#1C2028] rounded-lg"
          >
            {(
              [
                { id: 'all', label: `All (${counts.total})` },
                { id: 'scheduled', label: `Upcoming (${counts.scheduled})` },
                { id: 'completed', label: `Played (${counts.completed})` },
                { id: 'preplayed', label: `Pre-played (${counts.preplayed})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={filterMode === tab.id}
                onClick={() => setFilterMode(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === tab.id
                    ? 'bg-white dark:bg-[#2A303C] text-[#111318] dark:text-white shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#111318] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="fixture-team-filter">
            Filter by team
          </label>
          <select
            id="fixture-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-9 px-3 rounded-lg text-xs font-medium bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] text-[#111318] dark:text-[#F3F4F6] focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          >
            <option value="all">All 6 Teams</option>
            {season.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {!readOnly && season.status === 'active' && (
          <div className="flex flex-wrap items-center gap-2">
            {onAddManualFixture && (
              <button
                type="button"
                onClick={onAddManualFixture}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#1C2028] border border-[#D8DEE9] dark:border-[#2E3440] text-[#111318] dark:text-[#F3F4F6] hover:bg-[#F3F4F6] dark:hover:bg-[#252A34] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Fixture</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenRecordPastMatch}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#1C2028] border border-[#D8DEE9] dark:border-[#2E3440] text-[#111318] dark:text-[#F3F4F6] hover:bg-[#F3F4F6] dark:hover:bg-[#252A34] transition-colors whitespace-nowrap shrink-0"
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Record Past Match</span>
            </button>

            {counts.scheduled > 0 && (
              <button
                type="button"
                onClick={onReshuffleFixtures}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#1C2028] border border-[#D8DEE9] dark:border-[#2E3440] text-[#111318] dark:text-[#F3F4F6] hover:bg-[#F3F4F6] dark:hover:bg-[#252A34] transition-colors whitespace-nowrap shrink-0"
              >
                <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Shuffle Schedule</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {groupedByRound.length === 0 ? (
        <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#111318] dark:text-white">
            No fixtures match this filter
          </p>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
            Switch filters or select &ldquo;All 6 Teams&rdquo; to see the full schedule.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterMode('all');
              setTeamFilter('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByRound.map(([roundNum, roundMatches]) => {
            const legLabel =
              season.format === 'home-away'
                ? roundNum <= 5
                  ? 'First Leg (ပထမအကျော့)'
                  : 'Second Leg (ဒုတိယအကျော့)'
                : 'Single Round-Robin (တစ်ကျော့ပတ်လည်)';

            return (
              <section
                key={roundNum}
                aria-label={`Round ${roundNum}`}
                className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden"
              >
                <header className="px-4 py-3 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <h3 className="font-bold text-[#111318] dark:text-white">
                      Matchday {roundNum}
                    </h3>
                    <span className="text-[#94A3B8]" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">{legLabel}</span>
                  </div>
                  <span className="text-xs font-mono-num text-[#64748B] dark:text-[#94A3B8]">
                    {roundMatches.filter((m) => m.status === 'completed').length}/
                    {roundMatches.length} played
                  </span>
                </header>

                <div className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
                  {roundMatches.map((match) => {
                    const home = teamMap.get(match.homeTeamId);
                    const away = teamMap.get(match.awayTeamId);
                    if (!home || !away) return null;

                    const isPlayed = match.status === 'completed';
                    const homeWon =
                      isPlayed && (match.homeScore ?? 0) > (match.awayScore ?? 0);
                    const awayWon =
                      isPlayed && (match.awayScore ?? 0) > (match.homeScore ?? 0);

                    const homeGoals = match.goals.filter((g) => g.teamId === home.id);
                    const awayGoals = match.goals.filter((g) => g.teamId === away.id);

                    return (
                      <div
                        key={match.id}
                        className="px-4 py-3.5 hover:bg-[#F8F9FB] dark:hover:bg-[#1C2027] transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Teams & Scoreline */}
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                            {/* Home Team */}
                            <div className="flex items-center justify-end gap-2.5 min-w-0">
                              <span
                                className={`text-sm truncate text-right ${
                                  homeWon
                                    ? 'font-bold text-[#111318] dark:text-white'
                                    : 'font-medium text-[#334155] dark:text-[#CBD5E1]'
                                }`}
                              >
                                {home.name}
                              </span>
                              <ClubLogo
                                logoId={home.logoId}
                                customLogoUrl={home.customLogoUrl}
                                teamName={home.name}
                                size={28}
                              />
                            </div>

                            {/* Center Score / VS */}
                            <div className="w-20 text-center shrink-0">
                              {isPlayed ? (
                                <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#232832] font-mono-num text-sm font-bold text-[#111318] dark:text-white">
                                  <span>{match.homeScore}</span>
                                  <span className="text-[#94A3B8]">-</span>
                                  <span>{match.awayScore}</span>
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] font-mono-num">
                                  VS
                                </span>
                              )}
                            </div>

                            {/* Away Team */}
                            <div className="flex items-center justify-start gap-2.5 min-w-0">
                              <ClubLogo
                                logoId={away.logoId}
                                customLogoUrl={away.customLogoUrl}
                                teamName={away.name}
                                size={28}
                              />
                              <span
                                className={`text-sm truncate ${
                                  awayWon
                                    ? 'font-bold text-[#111318] dark:text-white'
                                    : 'font-medium text-[#334155] dark:text-[#CBD5E1]'
                                }`}
                              >
                                {away.name}
                              </span>
                            </div>
                          </div>

                          {/* Right meta & edit button */}
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:w-64 shrink-0">
                            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                              {match.isPrePlayed && (
                                <span className="text-[#D97706] dark:text-[#FBBF24] font-medium">
                                  Pre-played
                                </span>
                              )}
                              {match.isPrePlayed && match.playedAt && (
                                <span aria-hidden="true">·</span>
                              )}
                              {match.playedAt && (
                                <span className="inline-flex items-center gap-1 font-mono-num">
                                  <Calendar className="w-3 h-3" aria-hidden="true" />
                                  {match.playedAt}
                                </span>
                              )}
                            </div>

                            {!readOnly && (
                              <div className="flex items-center gap-1.5">
                                {onArrangeMatch && !isPlayed && (
                                  <button
                                    type="button"
                                    onClick={() => onArrangeMatch(match)}
                                    aria-label={`Arrange fixture ${home.name} vs ${away.name}`}
                                    title="Manually change matchday or teams"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#475569] dark:text-[#CBD5E1] bg-[#F1F5F9] dark:bg-[#232832] hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440] transition-colors whitespace-nowrap shrink-0"
                                  >
                                    <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                                    <span>Arrange</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onEditMatch(match)}
                                  aria-label={
                                    isPlayed
                                      ? `Edit result for ${home.name} vs ${away.name}`
                                      : `Enter result for ${home.name} vs ${away.name}`
                                  }
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                    isPlayed
                                      ? 'text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E8EBF0] dark:hover:bg-[#262B35]'
                                      : 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                                  }`}
                                >
                                  {isPlayed ? (
                                    <>
                                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Edit</span>
                                    </>
                                  ) : (
                                    <>
                                      <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Enter Result</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Goal Scorers & Assists Summary */}
                        {isPlayed && (homeGoals.length > 0 || awayGoals.length > 0) && (
                          <div className="mt-2.5 pt-2 border-t border-[#F1F5F9] dark:border-[#20242C] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                            <div className="sm:text-right sm:pr-4 space-y-0.5">
                              {homeGoals.map((g) => (
                                <div key={g.id}>
                                  <span className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                                    {g.scorer}
                                  </span>
                                  {g.minute ? (
                                    <span className="font-mono-num ml-1">{g.minute}&apos;</span>
                                  ) : null}
                                  {g.assist ? (
                                    <span className="ml-1.5 text-[#64748B] dark:text-[#8B95A5]">
                                      (ast. {g.assist})
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            <div className="sm:pl-4 space-y-0.5">
                              {awayGoals.map((g) => (
                                <div key={g.id}>
                                  <span className="font-medium text-[#1E293B] dark:text-[#E2E8F0]">
                                    {g.scorer}
                                  </span>
                                  {g.minute ? (
                                    <span className="font-mono-num ml-1">{g.minute}&apos;</span>
                                  ) : null}
                                  {g.assist ? (
                                    <span className="ml-1.5 text-[#64748B] dark:text-[#8B95A5]">
                                      (ast. {g.assist})
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
