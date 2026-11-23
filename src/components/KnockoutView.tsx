import React, { useMemo } from 'react';
import { Archive, ArrowDownRight, Edit3, PlusCircle, Trophy } from 'lucide-react';
import type { KnockoutMatch, Season, StandingRow, Team } from '../types/league';
import { ClubLogo } from '../data/clubLogos';
import {
  getKnockoutWinnerId,
  getSeasonChampion,
  isGroupStageComplete,
} from '../utils/leagueEngine';

interface KnockoutViewProps {
  season: Season;
  standings: StandingRow[];
  onEditKnockout: (stage: 'sf1' | 'sf2' | 'final') => void;
  onCompleteSeason?: () => void;
  readOnly?: boolean;
}

export const KnockoutView: React.FC<KnockoutViewProps> = ({
  season,
  standings,
  onEditKnockout,
  onCompleteSeason,
  readOnly = false,
}) => {
  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    season.teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [season.teams]);

  const groupDone = isGroupStageComplete(season);
  const champion = getSeasonChampion(season);
  const relegatedRows = standings.slice(4, 6);

  const renderTieCard = (
    match: KnockoutMatch,
    stage: 'sf1' | 'sf2' | 'final',
    seedHome?: string,
    seedAway?: string
  ) => {
    const home = match.homeTeamId ? teamMap.get(match.homeTeamId) : null;
    const away = match.awayTeamId ? teamMap.get(match.awayTeamId) : null;
    const winnerId = getKnockoutWinnerId(match);
    const canEdit = !readOnly && Boolean(home && away);

    return (
      <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#111318] dark:text-white">
            {match.label}
          </span>
          <span className="text-[11px] font-mono-num text-[#64748B] dark:text-[#94A3B8]">
            {match.status === 'completed'
              ? match.playedAt || 'Full Time'
              : groupDone
              ? 'Ready to play'
              : 'Projected from Top 4'}
          </span>
        </div>

        <div className="p-4 space-y-2.5">
          {/* Home Team Row */}
          <div
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg ${
              winnerId && winnerId === home?.id
                ? 'bg-[#16A34A]/10 dark:bg-[#00C853]/12'
                : 'bg-[#F8F9FB] dark:bg-[#12151A]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {seedHome && (
                <span className="text-[11px] font-mono-num font-bold text-[#64748B] w-5">
                  {seedHome}
                </span>
              )}
              {home ? (
                <>
                  <ClubLogo
                    logoId={home.logoId}
                    customLogoUrl={home.customLogoUrl}
                    teamName={home.name}
                    size={26}
                  />
                  <span
                    className={`text-sm truncate ${
                      winnerId === home.id
                        ? 'font-bold text-[#111318] dark:text-white'
                        : 'font-medium text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {home.name}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#64748B] dark:text-[#8B95A5]">
                  TBD (Winner of Tie 1)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-[#111318] dark:text-white shrink-0">
              <span>{match.homeScore ?? '-'}</span>
              {match.homePenalties !== null && match.homePenalties !== undefined && (
                <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  ({match.homePenalties})
                </span>
              )}
            </div>
          </div>

          {/* Away Team Row */}
          <div
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg ${
              winnerId && winnerId === away?.id
                ? 'bg-[#16A34A]/10 dark:bg-[#00C853]/12'
                : 'bg-[#F8F9FB] dark:bg-[#12151A]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {seedAway && (
                <span className="text-[11px] font-mono-num font-bold text-[#64748B] w-5">
                  {seedAway}
                </span>
              )}
              {away ? (
                <>
                  <ClubLogo
                    logoId={away.logoId}
                    customLogoUrl={away.customLogoUrl}
                    teamName={away.name}
                    size={26}
                  />
                  <span
                    className={`text-sm truncate ${
                      winnerId === away.id
                        ? 'font-bold text-[#111318] dark:text-white'
                        : 'font-medium text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {away.name}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[#64748B] dark:text-[#8B95A5]">
                  TBD (Winner of Tie 2)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-mono-num text-sm font-bold text-[#111318] dark:text-white shrink-0">
              <span>{match.awayScore ?? '-'}</span>
              {match.awayPenalties !== null && match.awayPenalties !== undefined && (
                <span className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                  ({match.awayPenalties})
                </span>
              )}
            </div>
          </div>

          {/* Scorers summary */}
          {match.goals.length > 0 && (
            <div className="pt-2 border-t border-[#ECEFF4] dark:border-[#22262E] text-[11px] text-[#64748B] dark:text-[#94A3B8] space-y-0.5">
              {match.goals.map((g) => {
                const t = teamMap.get(g.teamId);
                return (
                  <div key={g.id}>
                    <span className="font-mono-num font-semibold text-[#475569] dark:text-[#CBD5E1] mr-1.5">
                      {t?.shortName}
                    </span>
                    <span className="font-medium text-[#111318] dark:text-[#E2E8F0]">
                      {g.scorer}
                    </span>
                    {g.minute ? <span className="font-mono-num ml-1">{g.minute}&apos;</span> : null}
                    {g.assist ? <span className="ml-1">(ast. {g.assist})</span> : null}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onEditKnockout(stage)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  match.status === 'completed'
                    ? 'text-[#475569] dark:text-[#CBD5E1] hover:bg-[#E8EBF0] dark:hover:bg-[#262B35]'
                    : 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                }`}
              >
                {match.status === 'completed' ? (
                  <>
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Edit Score</span>
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#111318] dark:text-white">
            Top 4 Knockout Stage (ကွာတားဖိုင်နယ် &amp; ဗိုလ်လုပွဲ)
          </h2>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {groupDone
              ? 'Group stage complete. Top 4 teams battle for the title while #5 and #6 are relegated.'
              : 'Group stage still in progress — matchups below automatically reflect the current Top 4 standings (#1 vs #4, #2 vs #3).'}
          </p>
        </div>

        {!readOnly && season.status === 'active' && champion && onCompleteSeason && (
          <button
            type="button"
            onClick={onCompleteSeason}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors whitespace-nowrap shrink-0"
          >
            <Archive className="w-4 h-4" aria-hidden="true" />
            <span>Finish &amp; Archive Season</span>
          </button>
        )}
      </div>

      {/* Champion Banner */}
      {champion && (
        <div className="bg-white dark:bg-[#171A1F] border border-[#16A34A]/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#16A34A]/15 text-[#16A34A] dark:text-[#22C55E] flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#15803D] dark:text-[#22C55E]">
                Season Champion (ချန်ပီယံ)
              </div>
              <div className="mt-1 flex items-center gap-2.5">
                <ClubLogo
                  logoId={champion.logoId}
                  customLogoUrl={champion.customLogoUrl}
                  teamName={champion.name}
                  size={28}
                />
                <span className="text-lg font-extrabold text-[#111318] dark:text-white">
                  {champion.name}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            {season.status === 'completed'
              ? `Archived on ${season.completedAt || season.createdAt}`
              : 'Ready to save into Season History'}
          </div>
        </div>
      )}

      {/* Bracket Grid: 2 Semis/Knockout Ties + Final */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            Top 4 Knockout Ties (ထိပ်ဆုံး ၄ သင်း ရှုံးထွက်ပွဲစဉ်)
          </div>
          {renderTieCard(season.knockout.sf1, 'sf1', '#1', '#4')}
          {renderTieCard(season.knockout.sf2, 'sf2', '#2', '#3')}
        </div>

        <div className="space-y-4">
          <div className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            Championship Final (ဗိုလ်လုပွဲ)
          </div>
          {renderTieCard(season.knockout.final, 'final')}

          {/* Relegation Zone (Bottom 2) */}
          <div className="bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#262A32] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#ECEFF4] dark:border-[#22262E] bg-[#FAFBFC] dark:bg-[#14171C] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#DC2626] dark:text-[#F87171]">
                <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                <span>Relegation Zone · Bottom 2 (တန်းဆင်းရမည့် ၂ သင်း)</span>
              </div>
            </div>
            <div className="divide-y divide-[#ECEFF4] dark:divide-[#22262E]">
              {relegatedRows.map((row) => (
                <div
                  key={row.team.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded font-mono-num text-xs font-bold bg-[#DC2626]/15 text-[#DC2626] dark:text-[#F87171]">
                      {row.rank}
                    </span>
                    <ClubLogo
                      logoId={row.team.logoId}
                      customLogoUrl={row.team.customLogoUrl}
                      teamName={row.team.name}
                      size={26}
                    />
                    <span className="text-sm font-semibold text-[#111318] dark:text-white truncate">
                      {row.team.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono-num text-[#64748B] dark:text-[#94A3B8] shrink-0">
                    <span>{row.played} PL</span>
                    <span>GD {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span>
                    <span className="font-bold text-[#111318] dark:text-white">
                      {row.points} PTS
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
