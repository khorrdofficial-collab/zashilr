import React from 'react';
import type { StandingRow } from '../types/league';
import { ClubLogo } from '../data/clubLogos';

interface StandingsTableProps {
  standings: StandingRow[];
  onSelectTeam?: (teamId: string) => void;
  selectedTeamId?: string | null;
  compact?: boolean;
}

const formStyles: Record<'W' | 'D' | 'L', string> = {
  W: 'bg-[#16A34A] text-white',
  D: 'bg-[#64748B] text-white',
  L: 'bg-[#DC2626] text-white',
};

const formLabel: Record<'W' | 'D' | 'L', string> = {
  W: 'Win',
  D: 'Draw',
  L: 'Loss',
};

export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  onSelectTeam,
  selectedTeamId,
  compact = false,
}) => {
  return (
    <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b border-[#E2E5EC] dark:border-[#262A32] text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
              <th scope="col" className="py-3 pl-4 pr-2 w-12 text-center">
                #
              </th>
              <th scope="col" className="py-3 px-2">
                Team
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-12" title="Played">
                PL
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-12" title="Won">
                W
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-12" title="Drawn">
                D
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-12" title="Lost">
                L
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-16" title="Goals For - Against">
                +/-
              </th>
              <th scope="col" className="py-3 px-2.5 text-center w-14" title="Goal Difference">
                GD
              </th>
              <th scope="col" className="py-3 px-3 text-center w-14 text-[#111318] dark:text-white">
                PTS
              </th>
              {!compact && (
                <th scope="col" className="py-3 pl-3 pr-4 text-right w-44">
                  Form (Last 5)
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
            {standings.map((row) => {
              const isKnockout = row.zone === 'knockout';
              const isSelected = selectedTeamId === row.team.id;
              const isDividerRow = row.rank === 4;

              return (
                <tr
                  key={row.team.id}
                  className={`transition-colors duration-150 ${
                    isDividerRow ? 'border-b-2 border-b-[#CBD5E1] dark:border-b-[#343B47]' : ''
                  } ${
                    isSelected
                      ? 'bg-[#00C853]/10 dark:bg-[#00C853]/12'
                      : 'hover:bg-[#F8F9FB] dark:hover:bg-[#1E2229]'
                  }`}
                >
                  {/* Rank with clear zone indicator */}
                  <td className="py-3 pl-4 pr-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md font-mono-num text-xs font-bold ${
                        isKnockout
                          ? 'bg-[#16A34A]/15 text-[#15803D] dark:bg-[#00C853]/15 dark:text-[#22C55E]'
                          : 'bg-[#DC2626]/15 text-[#B91C1C] dark:bg-[#EF4444]/15 dark:text-[#F87171]'
                      }`}
                      title={
                        isKnockout
                          ? 'Top 4 Knockout Qualification'
                          : 'Bottom 2 Relegation Zone'
                      }
                    >
                      {row.rank}
                    </span>
                  </td>

                  {/* Team Name + Club Logo */}
                  <td className="py-3 px-2">
                    {onSelectTeam ? (
                      <button
                        type="button"
                        onClick={() => onSelectTeam(row.team.id)}
                        className="flex items-center gap-3 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] rounded-md py-0.5 pr-2"
                      >
                        <ClubLogo
                          logoId={row.team.logoId}
                          customLogoUrl={row.team.customLogoUrl}
                          teamName={row.team.name}
                          size={30}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[#111318] dark:text-[#F3F4F6] group-hover:text-[#16A34A] dark:group-hover:text-[#22C55E] transition-colors truncate">
                            {row.team.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#8B95A5]">
                            {isKnockout ? 'Top 4 · Knockout' : 'Bottom 2 · Relegation'}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <ClubLogo
                          logoId={row.team.logoId}
                          customLogoUrl={row.team.customLogoUrl}
                          teamName={row.team.name}
                          size={30}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-[#111318] dark:text-[#F3F4F6] truncate">
                            {row.team.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#8B95A5]">
                            {isKnockout ? 'Top 4 · Knockout' : 'Bottom 2 · Relegation'}
                          </div>
                        </div>
                      </div>
                    )}
                  </td>

                  {/* PL */}
                  <td className="py-3 px-2.5 text-center font-mono-num text-sm text-[#334155] dark:text-[#CBD5E1]">
                    {row.played}
                  </td>

                  {/* W */}
                  <td className="py-3 px-2.5 text-center font-mono-num text-sm text-[#334155] dark:text-[#CBD5E1]">
                    {row.won}
                  </td>

                  {/* D */}
                  <td className="py-3 px-2.5 text-center font-mono-num text-sm text-[#334155] dark:text-[#CBD5E1]">
                    {row.drawn}
                  </td>

                  {/* L */}
                  <td className="py-3 px-2.5 text-center font-mono-num text-sm text-[#334155] dark:text-[#CBD5E1]">
                    {row.lost}
                  </td>

                  {/* +/- */}
                  <td className="py-3 px-2.5 text-center font-mono-num text-sm text-[#475569] dark:text-[#94A3B8]">
                    {row.goalsFor}-{row.goalsAgainst}
                  </td>

                  {/* GD */}
                  <td
                    className={`py-3 px-2.5 text-center font-mono-num text-sm font-semibold ${
                      row.goalDifference > 0
                        ? 'text-[#15803D] dark:text-[#22C55E]'
                        : row.goalDifference < 0
                        ? 'text-[#DC2626] dark:text-[#F87171]'
                        : 'text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  >
                    {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                  </td>

                  {/* PTS */}
                  <td className="py-3 px-3 text-center font-mono-num text-sm font-bold text-[#111318] dark:text-white">
                    {row.points}
                  </td>

                  {/* Form (Last 5: Green W, Gray D, Red L) */}
                  {!compact && (
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const offset = 5 - row.form.length;
                          const entry = idx >= offset ? row.form[idx - offset] : null;
                          if (!entry) {
                            return (
                              <span
                                key={`empty-${idx}`}
                                aria-label="Not played"
                                className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-dashed border-[#CBD5E1] dark:border-[#323844] text-[10px] text-[#94A3B8] dark:text-[#475569]"
                              >
                                -
                              </span>
                            );
                          }
                          return (
                            <span
                              key={entry.matchId}
                              title={`${formLabel[entry.outcome]} (${entry.goalsFor}-${entry.goalsAgainst} vs ${entry.opponentName})`}
                              aria-label={`${formLabel[entry.outcome]} ${entry.goalsFor}-${entry.goalsAgainst} vs ${entry.opponentName}`}
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold leading-none ${formStyles[entry.outcome]}`}
                            >
                              {entry.outcome}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Explicit Zone & Form Legend (color + text for accessibility) */}
      <div className="px-4 py-3 border-t border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono-num text-[11px] font-bold bg-[#16A34A]/15 text-[#15803D] dark:bg-[#00C853]/15 dark:text-[#22C55E]">
              1-4
            </span>
            <span>Top 4 · Knockout (ကွာတားဖိုင်နယ်တက်)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono-num text-[11px] font-bold bg-[#DC2626]/15 text-[#B91C1C] dark:bg-[#EF4444]/15 dark:text-[#F87171]">
              5-6
            </span>
            <span>Bottom 2 · Relegated (တန်းဆင်း)</span>
          </div>
        </div>

        {!compact && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold bg-[#16A34A] text-white">
                W
              </span>
              <span>Win (နိုင်)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold bg-[#64748B] text-white">
                D
              </span>
              <span>Draw (သရေ)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold bg-[#DC2626] text-white">
                L
              </span>
              <span>Loss (ရှုံး)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
