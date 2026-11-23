import React, { useMemo, useState } from 'react';
import { Award, ChevronRight, Target, Trophy } from 'lucide-react';
import type { Season } from '../types/league';
import { ClubLogo } from '../data/clubLogos';
import {
  calculatePlayerStats,
  calculateStandings,
  getSeasonChampion,
  getSeasonRunnerUp,
} from '../utils/leagueEngine';
import { StandingsTable } from './StandingsTable';
import { FixturesView } from './FixturesView';
import { KnockoutView } from './KnockoutView';
import { PlayerStatsView } from './PlayerStatsView';

interface HistoryViewProps {
  seasons: Season[];
  isAdmin: boolean;
  onStartNewSeason: () => void;
}

type ArchiveTab = 'standings' | 'fixtures' | 'knockout' | 'stats';

export const HistoryView: React.FC<HistoryViewProps> = ({
  seasons,
  isAdmin,
  onStartNewSeason,
}) => {
  const completedSeasons = useMemo(
    () => seasons.filter((s) => s.status === 'completed'),
    [seasons]
  );

  const [selectedId, setSelectedId] = useState<string>(
    completedSeasons[0]?.id ?? seasons[0]?.id ?? ''
  );
  const [subTab, setSubTab] = useState<ArchiveTab>('standings');

  const selectedSeason = useMemo(
    () =>
      completedSeasons.find((s) => s.id === selectedId) ??
      completedSeasons[0] ??
      null,
    [completedSeasons, selectedId]
  );

  const selectedStandings = useMemo(
    () =>
      selectedSeason
        ? calculateStandings(selectedSeason.teams, selectedSeason.matches)
        : [],
    [selectedSeason]
  );

  if (completedSeasons.length === 0) {
    return (
      <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl p-10 text-center">
        <Trophy className="w-8 h-8 text-[#64748B] mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-base font-bold text-[#111318] dark:text-white">
          No Archived Seasons Yet (ရာသီမှတ်တမ်း မရှိသေးပါ)
        </h2>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5 max-w-md mx-auto">
          Complete your active season&apos;s group stage and Top 4 knockout final, then click
          &ldquo;Finish &amp; Archive Season&rdquo; to preserve all standings, fixtures, and
          player stats here.
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={onStartNewSeason}
            className="mt-5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
          >
            Create New Season
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Completed Season Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {completedSeasons.map((season) => {
          const champ = getSeasonChampion(season);
          const runner = getSeasonRunnerUp(season);
          const { topScorers, topAssists } = calculatePlayerStats([season], season.id);
          const isSelected = selectedSeason?.id === season.id;

          return (
            <button
              key={season.id}
              type="button"
              onClick={() => {
                setSelectedId(season.id);
                setSubTab('standings');
              }}
              className={`text-left p-4 rounded-xl border transition-colors ${
                isSelected
                  ? 'bg-white dark:bg-[#1B2028] border-[#16A34A] ring-1 ring-[#16A34A]'
                  : 'bg-white dark:bg-[#171A1F] border-[#E2E5EC] dark:border-[#262A32] hover:border-[#94A3B8] dark:hover:border-[#3E4656]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-[#111318] dark:text-white">
                    {season.name}
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    {season.format === 'home-away' ? 'Home & Away' : 'Single Round-Robin'} ·{' '}
                    {season.matches.length} Matches
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    isSelected ? 'text-[#16A34A]' : 'text-[#94A3B8]'
                  }`}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-4 pt-3 border-t border-[#ECEFF4] dark:border-[#242933] space-y-2 text-xs">
                {champ && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
                      Champion
                    </span>
                    <span className="font-semibold text-[#111318] dark:text-white inline-flex items-center gap-1.5 truncate">
                      <ClubLogo
                        logoId={champ.logoId}
                        customLogoUrl={champ.customLogoUrl}
                        teamName={champ.name}
                        size={18}
                      />
                      {champ.name}
                    </span>
                  </div>
                )}

                {runner && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Runner-up</span>
                    <span className="font-medium text-[#334155] dark:text-[#CBD5E1] truncate">
                      {runner.name}
                    </span>
                  </div>
                )}

                {topScorers[0] && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" aria-hidden="true" />
                      Top Scorer
                    </span>
                    <span className="font-medium text-[#334155] dark:text-[#CBD5E1] font-mono-num">
                      {topScorers[0].playerName} ({topScorers[0].goals})
                    </span>
                  </div>
                )}

                {topAssists[0] && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#64748B] dark:text-[#94A3B8] inline-flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" aria-hidden="true" />
                      Top Assist
                    </span>
                    <span className="font-medium text-[#334155] dark:text-[#CBD5E1] font-mono-num">
                      {topAssists[0].playerName} ({topAssists[0].assists})
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Historical Season Drill-down */}
      {selectedSeason && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E5EC] dark:border-[#262A32]">
            <div>
              <h2 className="text-base font-bold text-[#111318] dark:text-white">
                Archive: {selectedSeason.name}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Completed {selectedSeason.completedAt || selectedSeason.createdAt} · Full
                Standings, Fixtures, Knockout &amp; Stats
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Season archive sections"
              className="inline-flex items-center p-1 bg-[#E8EBF0] dark:bg-[#1C2028] rounded-lg w-fit"
            >
              {(
                [
                  { id: 'standings', label: 'Standings' },
                  { id: 'fixtures', label: 'Fixtures' },
                  { id: 'knockout', label: 'Knockout' },
                  { id: 'stats', label: 'Scorers & Assists' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={subTab === tab.id}
                  onClick={() => setSubTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    subTab === tab.id
                      ? 'bg-white dark:bg-[#2A303C] text-[#111318] dark:text-white shadow-xs'
                      : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {subTab === 'standings' && <StandingsTable standings={selectedStandings} />}
          {subTab === 'fixtures' && (
            <FixturesView
              season={selectedSeason}
              readOnly
              onEditMatch={() => {}}
              onReshuffleFixtures={() => {}}
              onOpenRecordPastMatch={() => {}}
            />
          )}
          {subTab === 'knockout' && (
            <KnockoutView
              season={selectedSeason}
              standings={selectedStandings}
              readOnly
              onEditKnockout={() => {}}
            />
          )}
          {subTab === 'stats' && (
            <PlayerStatsView
              seasons={[selectedSeason]}
              activeSeason={selectedSeason}
              forceSeasonOnly
            />
          )}
        </div>
      )}
    </div>
  );
};
