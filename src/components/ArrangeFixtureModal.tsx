import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Trash2, X } from 'lucide-react';
import type { Match, Season } from '../types/league';
import { ClubLogo } from '../data/clubLogos';

interface ArrangeFixtureModalProps {
  season: Season;
  match?: Match | null; // Null/undefined means adding a brand new manual fixture
  onClose: () => void;
  onSave: (payload: { round: number; homeTeamId: string; awayTeamId: string }) => void;
  onDelete?: () => void;
}

export const ArrangeFixtureModal: React.FC<ArrangeFixtureModalProps> = ({
  season,
  match,
  onClose,
  onSave,
  onDelete,
}) => {
  const maxRound = season.format === 'home-away' ? 10 : 5;
  const [round, setRound] = useState<number>(match?.round ?? 1);
  const [homeTeamId, setHomeTeamId] = useState<string>(
    match?.homeTeamId ?? season.teams[0]?.id ?? ''
  );
  const [awayTeamId, setAwayTeamId] = useState<string>(
    match?.awayTeamId ?? season.teams[1]?.id ?? ''
  );
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

  const handleSwap = () => {
    setHomeTeamId(awayTeamId);
    setAwayTeamId(homeTeamId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      setError('Home team and away team must be different.');
      return;
    }
    onSave({ round, homeTeamId, awayTeamId });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrange-fixture-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#2A2F3A] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ECEFF4] dark:border-[#262A32] flex items-center justify-between gap-4">
          <div>
            <h2
              id="arrange-fixture-title"
              className="text-base font-bold text-[#111318] dark:text-white"
            >
              {match
                ? 'Arrange Fixture (ပွဲစဉ် ပြင်ဆင်စီစဉ်ရန်)'
                : 'Add Manual Fixture (ပွဲစဉ်သစ် ထည့်ရန်)'}
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Choose matchday round and team pairing manually
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close arrange fixture modal"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#111318] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#232832]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="arrange-round"
              className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
            >
              Matchday (ပွဲစဉ်အပတ်စဉ်)
            </label>
            <select
              id="arrange-round"
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
              className="w-full h-10 px-3 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
            >
              {Array.from({ length: maxRound }).map((_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  Matchday {idx + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="arrange-home"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
              >
                Home Team (အိမ်ကွင်းအသင်း)
              </label>
              <div className="flex items-center gap-2.5">
                {homeTeam && (
                  <ClubLogo
                    logoId={homeTeam.logoId}
                    customLogoUrl={homeTeam.customLogoUrl}
                    teamName={homeTeam.name}
                    size={28}
                  />
                )}
                <select
                  id="arrange-home"
                  value={homeTeamId}
                  onChange={(e) => {
                    setHomeTeamId(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 h-10 px-3 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                >
                  {season.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440] transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Swap Home / Away</span>
              </button>
            </div>

            <div>
              <label
                htmlFor="arrange-away"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
              >
                Away Team (အဝေးကွင်းအသင်း)
              </label>
              <div className="flex items-center gap-2.5">
                {awayTeam && (
                  <ClubLogo
                    logoId={awayTeam.logoId}
                    customLogoUrl={awayTeam.customLogoUrl}
                    teamName={awayTeam.name}
                    size={28}
                  />
                )}
                <select
                  id="arrange-away"
                  value={awayTeamId}
                  onChange={(e) => {
                    setAwayTeamId(e.target.value);
                    setError(null);
                  }}
                  className="flex-1 h-10 px-3 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                >
                  {season.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#ECEFF4] dark:border-[#262A32]">
            <div>
              {match && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2] dark:hover:bg-[#DC2626]/15"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Remove Fixture</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
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
                {match ? 'Save Arrangement' : 'Add Fixture'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
