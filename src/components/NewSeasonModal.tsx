import React, { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import type { PrePlayedMatchInput, ScheduleFormat, Team } from '../types/league';
import { CLUB_LOGO_PRESETS, ClubLogo } from '../data/clubLogos';

interface NewSeasonModalProps {
  defaultSeasonNumber: number;
  previousTeams?: Team[];
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    format: ScheduleFormat;
    teams: Team[];
    prePlayedMatches: PrePlayedMatchInput[];
  }) => void;
}

interface DraftTeam {
  id: string;
  name: string;
  shortName: string;
  logoId: string;
  customLogoUrl?: string;
}

interface DraftPreMatch {
  key: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  playedAt: string;
  scorerText: string;
  assistText: string;
}

const DEFAULT_PRESET_IDS = [
  'real-madrid',
  'barcelona',
  'man-utd',
  'man-city',
  'arsenal',
  'liverpool',
];

export const NewSeasonModal: React.FC<NewSeasonModalProps> = ({
  defaultSeasonNumber,
  previousTeams,
  onClose,
  onCreate,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [seasonName, setSeasonName] = useState<string>(
    `ဇရှိလား Season ${defaultSeasonNumber}`
  );
  const [format, setFormat] = useState<ScheduleFormat>('home-away');

  // Start with blank team names so Admin manually enters their own 6 teams
  const [teams, setTeams] = useState<DraftTeam[]>(() =>
    DEFAULT_PRESET_IDS.map((logoId, idx) => ({
      id: `t-${idx + 1}`,
      name: '',
      shortName: `T${idx + 1}`,
      logoId,
    }))
  );

  const handleCopyPreviousTeams = () => {
    if (!previousTeams || previousTeams.length !== 6) return;
    setTeams(
      previousTeams.map((t, idx) => ({
        id: `t-${idx + 1}`,
        name: t.name,
        shortName: t.shortName,
        logoId: t.logoId,
        customLogoUrl: t.customLogoUrl,
      }))
    );
    setError(null);
  };

  const [pickingLogoForIndex, setPickingLogoForIndex] = useState<number | null>(null);
  const [logoSearch, setLogoSearch] = useState<string>('');
  const [logoRegion, setLogoRegion] = useState<string>('All');
  const [preMatches, setPreMatches] = useState<DraftPreMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredLogos = useMemo(() => {
    const q = logoSearch.trim().toLowerCase();
    return CLUB_LOGO_PRESETS.filter((p) => {
      if (logoRegion !== 'All' && p.region !== logoRegion) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.shortCode.toLowerCase().includes(q) ||
        p.region.toLowerCase().includes(q)
      );
    });
  }, [logoSearch, logoRegion]);

  const updateTeamField = (
    idx: number,
    field: keyof DraftTeam,
    value: string | undefined
  ) => {
    setTeams((prev) =>
      prev.map((t, i) => {
        if (i !== idx) return t;
        const next = { ...t, [field]: value };
        if (field === 'name' && typeof value === 'string') {
          const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (cleaned.length >= 2) {
            next.shortName = cleaned.slice(0, 3);
          }
        }
        return next;
      })
    );
    setError(null);
  };

  const handleUploadCustomLogo = (idx: number, file: File | undefined) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setError('Please upload a PNG, JPG, WEBP, or GIF image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 160;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const targetW = Math.max(1, Math.round((img.width || maxDim) * scale));
          const targetH = Math.max(1, Math.round((img.height || maxDim) * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compactUrl = canvas.toDataURL('image/png');
          setTeams((prev) =>
            prev.map((t, i) =>
              i === idx ? { ...t, logoId: 'custom', customLogoUrl: compactUrl } : t
            )
          );
          setPickingLogoForIndex(null);
          setError(null);
        } catch {
          setTeams((prev) =>
            prev.map((t, i) =>
              i === idx ? { ...t, logoId: 'custom', customLogoUrl: rawDataUrl } : t
            )
          );
          setPickingLogoForIndex(null);
          setError(null);
        }
      };
      img.onerror = () => {
        setError('Could not read the selected image file.');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const validateTeams = (): boolean => {
    if (!seasonName.trim()) {
      setError('Please enter a season name.');
      return false;
    }
    const names = teams.map((t) => t.name.trim());
    if (names.some((n) => n.length === 0)) {
      setError('All 6 teams must have a name.');
      return false;
    }
    const unique = new Set(names.map((n) => n.toLowerCase()));
    if (unique.size !== 6) {
      setError('Each of the 6 teams must have a unique name.');
      return false;
    }
    setError(null);
    return true;
  };

  const addDraftPreMatch = () => {
    setPreMatches((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random()}`,
        homeTeamId: teams[0].id,
        awayTeamId: teams[1].id,
        homeScore: 2,
        awayScore: 1,
        playedAt: new Date().toISOString().slice(0, 10),
        scorerText: '',
        assistText: '',
      },
    ]);
  };

  const handleFinalSubmit = () => {
    if (!validateTeams()) {
      setStep(1);
      return;
    }

    for (const pm of preMatches) {
      if (pm.homeTeamId === pm.awayTeamId) {
        setError('A pre-played match cannot have the same team on both sides.');
        return;
      }
    }

    const formattedPrePlayed: PrePlayedMatchInput[] = preMatches.map((pm) => {
      const goals: PrePlayedMatchInput['goals'] = [];
      if (pm.scorerText.trim()) {
        const scorerNames = pm.scorerText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const assistNames = pm.assistText
          .split(',')
          .map((s) => s.trim());
        scorerNames.forEach((scorer, idx) => {
          goals.push({
            teamId: idx < pm.homeScore ? pm.homeTeamId : pm.awayTeamId,
            scorer,
            assist: assistNames[idx] || undefined,
          });
        });
      }
      return {
        homeTeamId: pm.homeTeamId,
        awayTeamId: pm.awayTeamId,
        homeScore: pm.homeScore,
        awayScore: pm.awayScore,
        playedAt: pm.playedAt,
        goals,
        note: 'Pre-played before season schedule',
      };
    });

    const finalTeams: Team[] = teams.map((t, idx) => ({
      id: t.id,
      name: t.name.trim(),
      shortName: (t.shortName.trim() || `T${idx + 1}`).toUpperCase().slice(0, 3),
      logoId: t.logoId,
      customLogoUrl: t.customLogoUrl,
    }));

    onCreate({
      name: seasonName.trim(),
      format,
      teams: finalTeams,
      prePlayedMatches: formattedPrePlayed,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-season-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#2A2F3A] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 px-6 py-4 border-b border-[#ECEFF4] dark:border-[#262A32] bg-white dark:bg-[#171A1F] flex items-center justify-between gap-4">
          <div>
            <h2
              id="new-season-title"
              className="text-base font-bold text-[#111318] dark:text-white"
            >
              Create New 6-Team Season (ရာသီသစ် ဖွဲ့စည်းရန်)
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Step {step} of 2 ·{' '}
              {step === 1
                ? 'Choose format, enter 6 teams & pick football club logos'
                : 'Optional: add already-played offline matches before auto-generating fixtures'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new season modal"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#111318] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#232832]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 1 ? (
            <>
              {/* Season Name & Schedule Format */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="season-name-input"
                    className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
                  >
                    Season Name
                  </label>
                  <input
                    id="season-name-input"
                    type="text"
                    value={seasonName}
                    onChange={(e) => {
                      setSeasonName(e.target.value);
                      setError(null);
                    }}
                    placeholder="e.g. ဇရှိလား Season 1"
                    className="w-full h-10 px-3.5 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5">
                    Schedule Format (ပွဲစဉ်ပုံစံ)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormat('home-away')}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold transition-colors text-left flex items-center justify-between ${
                        format === 'home-away'
                          ? 'bg-[#16A34A]/10 border-[#16A34A] text-[#15803D] dark:text-[#22C55E]'
                          : 'bg-[#F8F9FB] dark:bg-[#12151A] border-[#D8DEE9] dark:border-[#2C323E] text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      <span>Home &amp; Away (30)</span>
                      {format === 'home-away' && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('once')}
                      className={`h-10 px-3 rounded-lg border text-xs font-semibold transition-colors text-left flex items-center justify-between ${
                        format === 'once'
                          ? 'bg-[#16A34A]/10 border-[#16A34A] text-[#15803D] dark:text-[#22C55E]'
                          : 'bg-[#F8F9FB] dark:bg-[#12151A] border-[#D8DEE9] dark:border-[#2C323E] text-[#475569] dark:text-[#94A3B8]'
                      }`}
                    >
                      <span>Once Only (15)</span>
                      {format === 'once' && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 6 Teams Grid */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-[#111318] dark:text-white">
                      Enter 6 Teams Manually &amp; Choose Club Logos (အသင်း ၆ သင်း ကိုယ်တိုင်ထည့်ပါ)
                    </span>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Click any crest to browse {CLUB_LOGO_PRESETS.length} club logos or upload
                    </p>
                  </div>
                  {previousTeams && previousTeams.length === 6 && (
                    <button
                      type="button"
                      onClick={handleCopyPreviousTeams}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#2E3440] whitespace-nowrap shrink-0"
                    >
                      Copy previous 6 teams
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teams.map((team, idx) => (
                    <div
                      key={team.id}
                      className={`p-3 rounded-xl border transition-colors ${
                        pickingLogoForIndex === idx
                          ? 'border-[#16A34A] bg-[#16A34A]/5'
                          : 'border-[#E2E5EC] dark:border-[#262A32] bg-[#F8F9FB] dark:bg-[#12151A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPickingLogoForIndex(pickingLogoForIndex === idx ? null : idx)
                          }
                          aria-label={`Change logo for Team ${idx + 1}`}
                          title="Choose club logo"
                          className="p-1.5 rounded-lg bg-white dark:bg-[#1B2028] border border-[#D8DEE9] dark:border-[#2E3440] hover:border-[#16A34A] transition-colors shrink-0"
                        >
                          <ClubLogo
                            logoId={team.logoId}
                            customLogoUrl={team.customLogoUrl}
                            teamName={team.name}
                            size={32}
                          />
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <label
                            htmlFor={`team-name-${idx}`}
                            className="block text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]"
                          >
                            Team #{idx + 1}
                          </label>
                          <input
                            id={`team-name-${idx}`}
                            type="text"
                            value={team.name}
                            onChange={(e) => updateTeamField(idx, 'name', e.target.value)}
                            placeholder={`Team ${idx + 1} name`}
                            className="w-full h-8 px-2.5 text-xs font-semibold rounded-md bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inline Club Logo Picker Drawer */}
              {pickingLogoForIndex !== null && (
                <div className="p-4 rounded-xl bg-[#F8F9FB] dark:bg-[#12151A] border border-[#16A34A]/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#111318] dark:text-white">
                      Select Logo for {teams[pickingLogoForIndex].name || `Team #${pickingLogoForIndex + 1}`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-[#1C2028] border border-[#D8DEE9] dark:border-[#2E3440] text-[#111318] dark:text-white cursor-pointer hover:border-[#16A34A]">
                        <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Upload Custom</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          aria-hidden="true"
                          tabIndex={-1}
                          onChange={(e) =>
                            handleUploadCustomLogo(pickingLogoForIndex, e.target.files?.[0])
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setPickingLogoForIndex(null)}
                        className="text-xs text-[#64748B] hover:text-[#111318] dark:hover:text-white px-2 py-1"
                      >
                        Done
                      </button>
                    </div>
                  </div>

                  {/* Search & Region Filter */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search
                        className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={logoSearch}
                        onChange={(e) => setLogoSearch(e.target.value)}
                        placeholder="Search club crest (Arsenal, Bayern, Yangon...)"
                        className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {['All', 'Premier', 'LaLiga', 'Europe', 'Myanmar', 'Classic'].map(
                        (region) => (
                          <button
                            key={region}
                            type="button"
                            onClick={() => setLogoRegion(region)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md whitespace-nowrap shrink-0 ${
                              logoRegion === region
                                ? 'bg-[#16A34A] text-white'
                                : 'bg-white dark:bg-[#1C2028] text-[#64748B] dark:text-[#94A3B8]'
                            }`}
                          >
                            {region}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Logo Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-48 overflow-y-auto pr-1">
                    {filteredLogos.map((preset) => {
                      const active = teams[pickingLogoForIndex].logoId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            updateTeamField(pickingLogoForIndex, 'logoId', preset.id);
                            updateTeamField(pickingLogoForIndex, 'customLogoUrl', undefined);
                          }}
                          className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-colors ${
                            active
                              ? 'border-[#16A34A] bg-[#16A34A]/12'
                              : 'border-[#E2E5EC] dark:border-[#262A32] bg-white dark:bg-[#171A1F] hover:border-[#94A3B8]'
                          }`}
                        >
                          <ClubLogo logoId={preset.id} size={28} />
                          <span className="text-[10px] font-medium text-[#334155] dark:text-[#CBD5E1] truncate w-full text-center">
                            {preset.shortCode}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Step 2: Optional Pre-Played Matches */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#111318] dark:text-white">
                    Already Played Offline Matches? (အရင်ကန်ပြီးသားပွဲများ ရှိပါသလား?)
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    Add your 1–2 previously played matches here. Our scheduler will auto-place
                    them in the season table and randomly schedule all remaining fixtures.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addDraftPreMatch}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Add Past Match</span>
                </button>
              </div>

              {preMatches.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#323844] text-center">
                  <p className="text-xs font-medium text-[#334155] dark:text-[#CBD5E1]">
                    No pre-played matches added (you can also add them later anytime).
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                    Click &ldquo;Generate Season Fixtures&rdquo; to auto-match all 6 teams into{' '}
                    {format === 'home-away' ? '10 rounds (30 matches)' : '5 rounds (15 matches)'}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {preMatches.map((pm, idx) => (
                    <div
                      key={pm.key}
                      className="p-4 rounded-xl bg-[#F8F9FB] dark:bg-[#12151A] border border-[#E2E5EC] dark:border-[#262A32] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111318] dark:text-white">
                          Pre-played Match #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setPreMatches((prev) => prev.filter((item) => item.key !== pm.key))
                          }
                          aria-label={`Remove pre-played match ${idx + 1}`}
                          className="p-1 text-[#64748B] hover:text-[#DC2626]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_64px_64px_1fr] gap-2 items-center">
                        <select
                          aria-label={`Pre-played match ${idx + 1} home team`}
                          value={pm.homeTeamId}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, homeTeamId: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="h-9 px-2.5 text-xs font-medium rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min={0}
                          max={30}
                          aria-label={`Pre-played match ${idx + 1} home score`}
                          value={pm.homeScore}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, homeScore: Math.max(0, Number(e.target.value) || 0) }
                                  : row
                              )
                            )
                          }
                          className="h-9 px-2 font-mono-num text-sm font-bold text-center rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        />

                        <input
                          type="number"
                          min={0}
                          max={30}
                          aria-label={`Pre-played match ${idx + 1} away score`}
                          value={pm.awayScore}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, awayScore: Math.max(0, Number(e.target.value) || 0) }
                                  : row
                              )
                            )
                          }
                          className="h-9 px-2 font-mono-num text-sm font-bold text-center rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        />

                        <select
                          aria-label={`Pre-played match ${idx + 1} away team`}
                          value={pm.awayTeamId}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, awayTeamId: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="h-9 px-2.5 text-xs font-medium rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Scorers comma-separated (e.g. Kyaw Kyaw, Htet Aung)"
                          value={pm.scorerText}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, scorerText: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="h-8 px-2.5 text-xs rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Assists comma-separated (optional)"
                          value={pm.assistText}
                          onChange={(e) =>
                            setPreMatches((prev) =>
                              prev.map((row) =>
                                row.key === pm.key
                                  ? { ...row, assistText: e.target.value }
                                  : row
                              )
                            )
                          }
                          className="h-8 px-2.5 text-xs rounded-lg bg-white dark:bg-[#171A1F] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
              {error}
            </p>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#ECEFF4] dark:border-[#262A32]">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1]"
              >
                Back to Teams
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1]"
              >
                Cancel
              </button>
            )}

            <div className="flex items-center gap-2.5">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (validateTeams()) setStep(2);
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
                >
                  Next: Pre-Played Matches
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D]"
                >
                  Generate Season Fixtures
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
