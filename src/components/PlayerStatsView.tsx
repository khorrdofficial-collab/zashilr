import React, { useMemo, useState } from 'react';
import { Award, Search, Target } from 'lucide-react';
import type { PlayerStatRow, Season } from '../types/league';
import { ClubLogo } from '../data/clubLogos';
import { calculatePlayerStats } from '../utils/leagueEngine';

interface PlayerStatsViewProps {
  seasons: Season[];
  activeSeason: Season;
  forceSeasonOnly?: boolean;
}

export const PlayerStatsView: React.FC<PlayerStatsViewProps> = ({
  seasons,
  activeSeason,
  forceSeasonOnly = false,
}) => {
  const [scope, setScope] = useState<'season' | 'all-time'>('season');
  const [search, setSearch] = useState<string>('');

  const { topScorers, topAssists } = useMemo(() => {
    const targetSeasonId = forceSeasonOnly || scope === 'season' ? activeSeason.id : undefined;
    return calculatePlayerStats(seasons, targetSeasonId);
  }, [seasons, activeSeason.id, scope, forceSeasonOnly]);

  const query = search.trim().toLowerCase();

  const filteredScorers = useMemo(() => {
    if (!query) return topScorers;
    return topScorers.filter(
      (p) =>
        p.playerName.toLowerCase().includes(query) ||
        p.teamName.toLowerCase().includes(query)
    );
  }, [topScorers, query]);

  const filteredAssists = useMemo(() => {
    if (!query) return topAssists;
    return topAssists.filter(
      (p) =>
        p.playerName.toLowerCase().includes(query) ||
        p.teamName.toLowerCase().includes(query)
    );
  }, [topAssists, query]);

  const renderLeaderboard = (
    title: string,
    burmeseSubtitle: string,
    metricLabel: string,
    rows: PlayerStatRow[],
    primaryKey: 'goals' | 'assists',
    Icon: React.ComponentType<{ className?: string }>
  ) => (
    <section className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
      <header className="px-4 py-3.5 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-[#16A34A] dark:text-[#22C55E]" />
          <div>
            <h3 className="text-sm font-bold text-[#111318] dark:text-white">{title}</h3>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{burmeseSubtitle}</p>
          </div>
        </div>
        <span className="text-xs font-mono-num text-[#64748B] dark:text-[#94A3B8]">
          {rows.length} {rows.length === 1 ? 'player' : 'players'}
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          No {primaryKey === 'goals' ? 'goal scorers' : 'assisters'} logged yet. Enter match
          results with player names to populate this leaderboard.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#ECEFF4] dark:border-[#22262E] text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                <th scope="col" className="py-2.5 pl-4 pr-2 w-10 text-center">
                  #
                </th>
                <th scope="col" className="py-2.5 px-2">
                  Player
                </th>
                <th scope="col" className="py-2.5 px-2 text-center w-14">
                  G+A
                </th>
                <th
                  scope="col"
                  className="py-2.5 pl-2 pr-4 text-right w-20 text-[#111318] dark:text-white"
                >
                  {metricLabel}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
              {rows.map((player) => (
                <tr
                  key={`${player.playerName}-${player.teamId}`}
                  className="hover:bg-[#F8F9FB] dark:hover:bg-[#1C2027] transition-colors"
                >
                  <td className="py-3 pl-4 pr-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono-num text-xs font-bold ${
                        player.rank === 1
                          ? 'bg-[#16A34A]/15 text-[#15803D] dark:bg-[#00C853]/15 dark:text-[#22C55E]'
                          : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    >
                      {player.rank}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ClubLogo
                        logoId={player.teamLogoId}
                        customLogoUrl={player.teamCustomLogoUrl}
                        teamName={player.teamName}
                        size={26}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#111318] dark:text-white truncate">
                          {player.playerName}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#8B95A5] truncate">
                          {player.teamName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center font-mono-num text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {player.contributions}
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right font-mono-num text-sm font-bold text-[#111318] dark:text-white">
                    {primaryKey === 'goals' ? player.goals : player.assists}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {!forceSeasonOnly ? (
          <div
            role="tablist"
            aria-label="Player stats scope"
            className="inline-flex items-center p-1 bg-[#E8EBF0] dark:bg-[#1C2028] rounded-lg w-fit"
          >
            <button
              role="tab"
              type="button"
              aria-selected={scope === 'season'}
              onClick={() => setScope('season')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scope === 'season'
                  ? 'bg-white dark:bg-[#2A303C] text-[#111318] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              {activeSeason.name}
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={scope === 'all-time'}
              onClick={() => setScope('all-time')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scope === 'all-time'
                  ? 'bg-white dark:bg-[#2A303C] text-[#111318] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              All-Time ({seasons.length} Seasons)
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            Season Player Leaderboards
          </div>
        )}

        <div className="relative w-full sm:w-64">
          <Search
            className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or club..."
            aria-label="Search player or club"
            className="w-full h-9 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
        </div>
      </div>

      {/* Separate Top Scorers & Top Assists Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {renderLeaderboard(
          'Top Scorers',
          'ဂိုးသွင်းအများဆုံး ကစားသမားများ',
          'Goals',
          filteredScorers,
          'goals',
          Target
        )}
        {renderLeaderboard(
          'Top Assists',
          'Assist အများဆုံး ကစားသမားများ',
          'Assists',
          filteredAssists,
          'assists',
          Award
        )}
      </div>
    </div>
  );
};
