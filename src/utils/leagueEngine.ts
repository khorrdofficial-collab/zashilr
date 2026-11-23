import type {
  FormEntry,
  FormOutcome,
  GoalEvent,
  KnockoutMatch,
  Match,
  PlayerStatRow,
  PrePlayedMatchInput,
  ScheduleFormat,
  Season,
  StandingRow,
  Team,
} from '../types/league';

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function createId(prefix: string, seedCounter?: number): string {
  if (typeof seedCounter === 'number') {
    return `${prefix}-${seedCounter}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyKnockout(seasonId: string): Season['knockout'] {
  return {
    sf1: {
      id: `${seasonId}-ko-sf1`,
      stage: 'sf1',
      label: 'Knockout 1 (#1 vs #4)',
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      goals: [],
    },
    sf2: {
      id: `${seasonId}-ko-sf2`,
      stage: 'sf2',
      label: 'Knockout 2 (#2 vs #3)',
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      goals: [],
    },
    final: {
      id: `${seasonId}-ko-final`,
      stage: 'final',
      label: 'Grand Final',
      homeTeamId: null,
      awayTeamId: null,
      homeScore: null,
      awayScore: null,
      homePenalties: null,
      awayPenalties: null,
      status: 'scheduled',
      goals: [],
    },
  };
}

/**
 * Generates randomized, balanced round-robin fixtures for 6 teams using the Berger table method.
 * - 'once': 5 rounds, 15 matches (every team meets every other team once)
 * - 'home-away': 10 rounds, 30 matches (double round-robin with reversed home/away in 2nd half)
 * Automatically integrates any pre-played real-world matches without creating duplicates.
 */
export function generateRoundRobinFixtures(
  teams: Team[],
  format: ScheduleFormat,
  prePlayedMatches: PrePlayedMatchInput[] = [],
  seed: number = Date.now()
): { matches: Match[]; nextCompletedOrder: number } {
  if (teams.length !== 6) {
    throw new Error(`Expected exactly 6 teams, got ${teams.length}`);
  }

  const rng = createRng(seed);
  const shuffledTeams = shuffleWithRng(teams, rng);

  // Circle/Berger method for N = 6 (even)
  const n = shuffledTeams.length;
  const fixed = shuffledTeams[0];
  const rotating = shuffledTeams.slice(1); // 5 teams
  const firstHalfRounds: Array<Array<{ homeTeamId: string; awayTeamId: string }>> = [];

  for (let roundIdx = 0; roundIdx < n - 1; roundIdx++) {
    const roundPairs: Array<{ homeTeamId: string; awayTeamId: string }> = [];
    const circle = [fixed, ...rotating];

    for (let i = 0; i < n / 2; i++) {
      const t1 = circle[i];
      const t2 = circle[n - 1 - i];
      // Alternate home/away for balanced venues
      const flip = (roundIdx + i) % 2 === 1;
      roundPairs.push(
        flip
          ? { homeTeamId: t2.id, awayTeamId: t1.id }
          : { homeTeamId: t1.id, awayTeamId: t2.id }
      );
    }

    firstHalfRounds.push(shuffleWithRng(roundPairs, rng));

    // Rotate clockwise
    const last = rotating.pop()!;
    rotating.unshift(last);
  }

  const orderedFirstHalf = shuffleWithRng(firstHalfRounds, rng);
  const allRounds = [...orderedFirstHalf];

  if (format === 'home-away') {
    const secondHalf = shuffleWithRng(orderedFirstHalf, rng).map((pairs) =>
      shuffleWithRng(
        pairs.map((p) => ({
          homeTeamId: p.awayTeamId,
          awayTeamId: p.homeTeamId,
        })),
        rng
      )
    );
    allRounds.push(...secondHalf);
  }

  let matchCounter = 1;
  const matches: Match[] = [];

  allRounds.forEach((roundPairs, idx) => {
    const roundNumber = idx + 1;
    roundPairs.forEach((pair) => {
      matches.push({
        id: `m-${seed.toString(36).slice(-4)}-${matchCounter++}`,
        round: roundNumber,
        homeTeamId: pair.homeTeamId,
        awayTeamId: pair.awayTeamId,
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        goals: [],
      });
    });
  });

  // Apply pre-played matches seamlessly into matching fixture slots
  let completedOrder = 1;
  for (const pre of prePlayedMatches) {
    if (pre.homeTeamId === pre.awayTeamId) continue;
    applyPrePlayedToMatches(matches, format, pre, completedOrder++);
  }

  return { matches, nextCompletedOrder: completedOrder };
}

function applyPrePlayedToMatches(
  matches: Match[],
  format: ScheduleFormat,
  input: PrePlayedMatchInput,
  completedOrder: number
): Match {
  const goalEvents: GoalEvent[] = input.goals.map((g, idx) => ({
    ...g,
    id: `g-${completedOrder}-${idx + 1}`,
    scorer: g.scorer.trim(),
    assist: g.assist?.trim() || undefined,
  }));

  // 1. Prefer exact home/away unplayed match
  let target = matches.find(
    (m) =>
      m.status === 'scheduled' &&
      m.homeTeamId === input.homeTeamId &&
      m.awayTeamId === input.awayTeamId
  );

  // 2. Otherwise match reversed unplayed pairing (especially important in 'once' mode)
  if (!target) {
    target = matches.find(
      (m) =>
        m.status === 'scheduled' &&
        m.homeTeamId === input.awayTeamId &&
        m.awayTeamId === input.homeTeamId
    );
    if (target) {
      target.homeTeamId = input.homeTeamId;
      target.awayTeamId = input.awayTeamId;
    }
  }

  if (target) {
    target.homeScore = input.homeScore;
    target.awayScore = input.awayScore;
    target.status = 'completed';
    target.playedAt = input.playedAt || new Date().toISOString().slice(0, 10);
    target.completedOrder = completedOrder;
    target.isPrePlayed = true;
    target.goals = goalEvents;
    target.note = input.note?.trim() || undefined;
    return target;
  }

  // 3. Fallback if all scheduled pairings between these 2 teams are already completed
  const fallbackRound = format === 'home-away' ? 10 : 5;
  const extra: Match = {
    id: createId('m-past', completedOrder),
    round: fallbackRound,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    status: 'completed',
    playedAt: input.playedAt || new Date().toISOString().slice(0, 10),
    completedOrder,
    isPrePlayed: true,
    goals: goalEvents,
    note: input.note?.trim() || undefined,
  };
  matches.push(extra);
  return extra;
}

/**
 * Records a real-world past match into an existing active season and syncs standings/knockout.
 */
export function recordPastMatchIntoSeason(
  season: Season,
  input: PrePlayedMatchInput
): Season {
  const clonedMatches = season.matches.map((m) => ({
    ...m,
    goals: [...m.goals],
  }));

  applyPrePlayedToMatches(clonedMatches, season.format, input, season.nextCompletedOrder);

  const updated: Season = {
    ...season,
    matches: clonedMatches,
    nextCompletedOrder: season.nextCompletedOrder + 1,
  };

  return syncSeasonKnockout(updated);
}

/**
 * Updates or resets a group match result inside a season and keeps knockout synced.
 */
export function updateMatchResultInSeason(
  season: Season,
  matchId: string,
  payload: {
    homeScore: number | null;
    awayScore: number | null;
    goals: GoalEvent[];
    playedAt?: string;
    note?: string;
    isPrePlayed?: boolean;
  }
): Season {
  let nextOrder = season.nextCompletedOrder;

  const updatedMatches = season.matches.map((m) => {
    if (m.id !== matchId) return m;
    const isCleared = payload.homeScore === null || payload.awayScore === null;
    if (isCleared) {
      return {
        ...m,
        homeScore: null,
        awayScore: null,
        status: 'scheduled' as const,
        playedAt: undefined,
        completedOrder: undefined,
        isPrePlayed: false,
        goals: [],
        note: undefined,
      };
    }

    const assignedOrder = m.completedOrder ?? nextOrder++;
    return {
      ...m,
      homeScore: payload.homeScore,
      awayScore: payload.awayScore,
      status: 'completed' as const,
      playedAt: payload.playedAt || m.playedAt || new Date().toISOString().slice(0, 10),
      completedOrder: assignedOrder,
      isPrePlayed: payload.isPrePlayed ?? m.isPrePlayed ?? false,
      goals: payload.goals.filter((g) => g.scorer.trim().length > 0),
      note: payload.note?.trim() || undefined,
    };
  });

  return syncSeasonKnockout({
    ...season,
    matches: updatedMatches,
    nextCompletedOrder: nextOrder,
  });
}

/**
 * Shuffles fixtures:
 * - If 0 matches have been played, regenerates the entire season round-robin cleanly with a new seed.
 * - If some matches are already played, preserves completed matches and shuffles the order of remaining unplayed rounds.
 */
export function reshuffleRemainingFixtures(
  season: Season,
  seed: number = Date.now()
): Season {
  const hasCompleted = season.matches.some((m) => m.status === 'completed');

  if (!hasCompleted) {
    const { matches, nextCompletedOrder } = generateRoundRobinFixtures(
      season.teams,
      season.format,
      [],
      seed
    );
    return {
      ...season,
      matches,
      nextCompletedOrder,
    };
  }

  const rng = createRng(seed);
  // Group unplayed rounds (rounds where NO match is completed) and shuffle their round numbers
  const roundsMap = new Map<number, Match[]>();
  for (const m of season.matches) {
    const list = roundsMap.get(m.round) ?? [];
    list.push(m);
    roundsMap.set(m.round, list);
  }

  const untouchedRounds: number[] = [];
  const movableRoundNums: number[] = [];

  for (const [rNum, rMatches] of roundsMap.entries()) {
    if (rMatches.some((m) => m.status === 'completed')) {
      untouchedRounds.push(rNum);
    } else {
      movableRoundNums.push(rNum);
    }
  }

  const shuffledSlots = shuffleWithRng(movableRoundNums, rng);
  const roundRemap = new Map<number, number>();
  movableRoundNums.forEach((oldRound, idx) => {
    roundRemap.set(oldRound, shuffledSlots[idx]);
  });

  const remappedMatches = season.matches.map((m) => {
    const newRound = roundRemap.get(m.round);
    return newRound ? { ...m, round: newRound } : m;
  });

  // Sort by round then shuffle within unplayed rounds
  remappedMatches.sort((a, b) => a.round - b.round);

  return {
    ...season,
    matches: remappedMatches,
  };
}

/**
 * Computes FotMob-style standings table for a 6-team league.
 * Tie-breakers: Points -> Goal Difference -> Goals For -> Head-to-Head -> Team Name
 */
export function calculateStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const teamMap = new Map<string, Team>();
  teams.forEach((t) => teamMap.set(t.id, t));

  const rowsMap = new Map<
    string,
    {
      team: Team;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      points: number;
      form: FormEntry[];
    }
  >();

  teams.forEach((team) => {
    rowsMap.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      form: [],
    });
  });

  // Sort completed matches chronologically for accurate Last-5 form
  const completedMatches = matches
    .filter(
      (m) =>
        m.status === 'completed' &&
        typeof m.homeScore === 'number' &&
        typeof m.awayScore === 'number'
    )
    .sort((a, b) => {
      const orderA = a.completedOrder ?? 0;
      const orderB = b.completedOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      if (a.playedAt && b.playedAt && a.playedAt !== b.playedAt) {
        return a.playedAt.localeCompare(b.playedAt);
      }
      return a.round - b.round;
    });

  for (const match of completedMatches) {
    const homeRow = rowsMap.get(match.homeTeamId);
    const awayRow = rowsMap.get(match.awayTeamId);
    if (!homeRow || !awayRow) continue;

    const hs = match.homeScore!;
    const as = match.awayScore!;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += hs;
    homeRow.goalsAgainst += as;
    awayRow.goalsFor += as;
    awayRow.goalsAgainst += hs;

    let homeOutcome: FormOutcome;
    let awayOutcome: FormOutcome;

    if (hs > as) {
      homeRow.won += 1;
      homeRow.points += 3;
      awayRow.lost += 1;
      homeOutcome = 'W';
      awayOutcome = 'L';
    } else if (hs < as) {
      awayRow.won += 1;
      awayRow.points += 3;
      homeRow.lost += 1;
      homeOutcome = 'L';
      awayOutcome = 'W';
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
      homeRow.points += 1;
      awayRow.points += 1;
      homeOutcome = 'D';
      awayOutcome = 'D';
    }

    homeRow.form.push({
      matchId: match.id,
      outcome: homeOutcome,
      opponentId: awayRow.team.id,
      opponentName: awayRow.team.name,
      goalsFor: hs,
      goalsAgainst: as,
      isHome: true,
    });

    awayRow.form.push({
      matchId: match.id,
      outcome: awayOutcome,
      opponentId: homeRow.team.id,
      opponentName: homeRow.team.name,
      goalsFor: as,
      goalsAgainst: hs,
      isHome: false,
    });
  }

  // Head-to-head helper between two teams
  const getHeadToHeadDiff = (teamAId: string, teamBId: string): number => {
    let ptsA = 0;
    let ptsB = 0;
    let gdA = 0;
    let gdB = 0;
    for (const m of completedMatches) {
      if (m.homeTeamId === teamAId && m.awayTeamId === teamBId) {
        const hs = m.homeScore!;
        const as = m.awayScore!;
        gdA += hs - as;
        gdB += as - hs;
        if (hs > as) ptsA += 3;
        else if (hs < as) ptsB += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      } else if (m.homeTeamId === teamBId && m.awayTeamId === teamAId) {
        const hs = m.homeScore!;
        const as = m.awayScore!;
        gdB += hs - as;
        gdA += as - hs;
        if (hs > as) ptsB += 3;
        else if (hs < as) ptsA += 3;
        else {
          ptsA += 1;
          ptsB += 1;
        }
      }
    }
    if (ptsB !== ptsA) return ptsB - ptsA;
    return gdB - gdA;
  };

  const rows: StandingRow[] = Array.from(rowsMap.values()).map((r) => ({
    rank: 0,
    team: r.team,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalsFor - r.goalsAgainst,
    points: r.points,
    form: r.form.slice(-5),
    zone: 'knockout',
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const h2h = getHeadToHeadDiff(a.team.id, b.team.id);
    if (h2h !== 0) return h2h;
    return a.team.name.localeCompare(b.team.name);
  });

  rows.forEach((row, index) => {
    row.rank = index + 1;
    row.zone = row.rank <= 4 ? 'knockout' : 'relegated';
  });

  return rows;
}

export function getKnockoutWinnerId(match: KnockoutMatch): string | null {
  if (
    match.status !== 'completed' ||
    !match.homeTeamId ||
    !match.awayTeamId ||
    match.homeScore === null ||
    match.awayScore === null
  ) {
    return null;
  }

  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;

  if (
    typeof match.homePenalties === 'number' &&
    typeof match.awayPenalties === 'number'
  ) {
    if (match.homePenalties > match.awayPenalties) return match.homeTeamId;
    if (match.awayPenalties > match.homePenalties) return match.awayTeamId;
  }

  return null;
}

export function isGroupStageComplete(season: Season): boolean {
  return season.matches.length > 0 && season.matches.every((m) => m.status === 'completed');
}

export function syncSeasonKnockout(season: Season): Season {
  const standings = calculateStandings(season.teams, season.matches);
  const top4 = standings.slice(0, 4).map((r) => r.team.id);

  const koStarted =
    season.knockout.sf1.status === 'completed' ||
    season.knockout.sf2.status === 'completed' ||
    season.knockout.final.status === 'completed';

  let sf1 = { ...season.knockout.sf1 };
  let sf2 = { ...season.knockout.sf2 };
  let final = { ...season.knockout.final };

  if (!koStarted && top4.length === 4) {
    sf1.homeTeamId = top4[0];
    sf1.awayTeamId = top4[3];
    sf2.homeTeamId = top4[1];
    sf2.awayTeamId = top4[2];
  }

  const sf1Winner = getKnockoutWinnerId(sf1);
  const sf2Winner = getKnockoutWinnerId(sf2);

  if (final.status !== 'completed') {
    final.homeTeamId = sf1Winner;
    final.awayTeamId = sf2Winner;
  }

  return {
    ...season,
    knockout: { sf1, sf2, final },
  };
}

export function updateKnockoutMatchInSeason(
  season: Season,
  stage: 'sf1' | 'sf2' | 'final',
  payload: {
    homeScore: number | null;
    awayScore: number | null;
    homePenalties?: number | null;
    awayPenalties?: number | null;
    goals: GoalEvent[];
    playedAt?: string;
  }
): Season {
  const current = season.knockout[stage];
  const isCleared = payload.homeScore === null || payload.awayScore === null;

  const updatedStage: KnockoutMatch = isCleared
    ? {
        ...current,
        homeScore: null,
        awayScore: null,
        homePenalties: null,
        awayPenalties: null,
        status: 'scheduled',
        playedAt: undefined,
        goals: [],
      }
    : {
        ...current,
        homeScore: payload.homeScore,
        awayScore: payload.awayScore,
        homePenalties: payload.homePenalties ?? null,
        awayPenalties: payload.awayPenalties ?? null,
        status: 'completed',
        playedAt: payload.playedAt || current.playedAt || new Date().toISOString().slice(0, 10),
        goals: payload.goals.filter((g) => g.scorer.trim().length > 0),
      };

  const nextKnockout = {
    ...season.knockout,
    [stage]: updatedStage,
  };

  // Update finalists when semis change
  if (stage === 'sf1' || stage === 'sf2') {
    const sf1W = getKnockoutWinnerId(nextKnockout.sf1);
    const sf2W = getKnockoutWinnerId(nextKnockout.sf2);
    const finalTeamsChanged =
      nextKnockout.final.homeTeamId !== sf1W || nextKnockout.final.awayTeamId !== sf2W;

    if (finalTeamsChanged) {
      nextKnockout.final = {
        ...nextKnockout.final,
        homeTeamId: sf1W,
        awayTeamId: sf2W,
        homeScore: null,
        awayScore: null,
        homePenalties: null,
        awayPenalties: null,
        status: 'scheduled',
        playedAt: undefined,
        goals: [],
      };
    }
  }

  return {
    ...season,
    knockout: nextKnockout,
  };
}

export function getSeasonChampion(season: Season): Team | null {
  const champId = getKnockoutWinnerId(season.knockout.final);
  if (!champId) return null;
  return season.teams.find((t) => t.id === champId) ?? null;
}

export function getSeasonRunnerUp(season: Season): Team | null {
  const champId = getKnockoutWinnerId(season.knockout.final);
  if (!champId) return null;
  const { homeTeamId, awayTeamId } = season.knockout.final;
  const runnerId = champId === homeTeamId ? awayTeamId : homeTeamId;
  return season.teams.find((t) => t.id === runnerId) ?? null;
}

/**
 * Aggregates Top Scorers and Top Assists across a specific season or all seasons.
 */
export function calculatePlayerStats(
  seasons: Season[],
  seasonId?: string
): {
  topScorers: PlayerStatRow[];
  topAssists: PlayerStatRow[];
} {
  const targetSeasons = seasonId ? seasons.filter((s) => s.id === seasonId) : seasons;

  const statsMap = new Map<
    string,
    {
      playerName: string;
      teamId: string;
      teamName: string;
      teamLogoId: string;
      teamCustomLogoUrl?: string;
      goals: number;
      assists: number;
      matchIds: Set<string>;
    }
  >();

  for (const season of targetSeasons) {
    const teamLookup = new Map<string, Team>();
    season.teams.forEach((t) => teamLookup.set(t.id, t));

    const allCompletedGames: Array<{ id: string; goals: GoalEvent[] }> = [
      ...season.matches
        .filter((m) => m.status === 'completed')
        .map((m) => ({ id: `${season.id}-${m.id}`, goals: m.goals })),
      ...[season.knockout.sf1, season.knockout.sf2, season.knockout.final]
        .filter((k) => k.status === 'completed')
        .map((k) => ({ id: `${season.id}-${k.id}`, goals: k.goals })),
    ];

    for (const game of allCompletedGames) {
      for (const ev of game.goals) {
        const team = teamLookup.get(ev.teamId);
        if (!team) continue;

        const scorerName = ev.scorer.trim();
        if (scorerName) {
          const key = seasonId
            ? `${scorerName.toLowerCase()}::${team.id}`
            : scorerName.toLowerCase();
          const existing = statsMap.get(key) ?? {
            playerName: scorerName,
            teamId: team.id,
            teamName: team.name,
            teamLogoId: team.logoId,
            teamCustomLogoUrl: team.customLogoUrl,
            goals: 0,
            assists: 0,
            matchIds: new Set<string>(),
          };
          existing.goals += 1;
          existing.teamId = team.id;
          existing.teamName = team.name;
          existing.teamLogoId = team.logoId;
          existing.teamCustomLogoUrl = team.customLogoUrl;
          existing.matchIds.add(game.id);
          statsMap.set(key, existing);
        }

        const assistName = ev.assist?.trim();
        if (assistName) {
          const key = seasonId
            ? `${assistName.toLowerCase()}::${team.id}`
            : assistName.toLowerCase();
          const existing = statsMap.get(key) ?? {
            playerName: assistName,
            teamId: team.id,
            teamName: team.name,
            teamLogoId: team.logoId,
            teamCustomLogoUrl: team.customLogoUrl,
            goals: 0,
            assists: 0,
            matchIds: new Set<string>(),
          };
          existing.assists += 1;
          existing.teamId = team.id;
          existing.teamName = team.name;
          existing.teamLogoId = team.logoId;
          existing.teamCustomLogoUrl = team.customLogoUrl;
          existing.matchIds.add(game.id);
          statsMap.set(key, existing);
        }
      }
    }
  }

  const allEntries = Array.from(statsMap.values()).map((entry) => ({
    rank: 0,
    playerName: entry.playerName,
    teamId: entry.teamId,
    teamName: entry.teamName,
    teamLogoId: entry.teamLogoId,
    teamCustomLogoUrl: entry.teamCustomLogoUrl,
    goals: entry.goals,
    assists: entry.assists,
    contributions: entry.goals + entry.assists,
    matchesWithGoalOrAssist: entry.matchIds.size,
  }));

  const topScorers = allEntries
    .filter((p) => p.goals > 0)
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.playerName.localeCompare(b.playerName);
    })
    .map((p, idx) => ({ ...p, rank: idx + 1 }));

  const topAssists = allEntries
    .filter((p) => p.assists > 0)
    .sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.playerName.localeCompare(b.playerName);
    })
    .map((p, idx) => ({ ...p, rank: idx + 1 }));

  return { topScorers, topAssists };
}

/**
 * Collects known player names for a specific team in a season (for fast autocomplete in result modal).
 */
export function getKnownTeamPlayers(season: Season, teamId: string): string[] {
  const names = new Set<string>();
  const allGoals = [
    ...season.matches.flatMap((m) => m.goals),
    ...season.knockout.sf1.goals,
    ...season.knockout.sf2.goals,
    ...season.knockout.final.goals,
  ];
  for (const g of allGoals) {
    if (g.teamId !== teamId) continue;
    if (g.scorer.trim()) names.add(g.scorer.trim());
    if (g.assist?.trim()) names.add(g.assist.trim());
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

/**
 * Allows Admin to manually arrange an existing fixture's round, home team, or away team.
 */
export function arrangeFixtureInSeason(
  season: Season,
  matchId: string,
  payload: {
    round: number;
    homeTeamId: string;
    awayTeamId: string;
  }
): Season {
  if (payload.homeTeamId === payload.awayTeamId) {
    throw new Error('Home team and away team must be different.');
  }
  const maxRound = season.format === 'home-away' ? 10 : 5;
  const clampedRound = Math.max(1, Math.min(maxRound, Math.floor(payload.round)));

  const updatedMatches = season.matches.map((m) => {
    if (m.id !== matchId) return m;
    return {
      ...m,
      round: clampedRound,
      homeTeamId: payload.homeTeamId,
      awayTeamId: payload.awayTeamId,
    };
  });

  updatedMatches.sort((a, b) => a.round - b.round);

  return syncSeasonKnockout({
    ...season,
    matches: updatedMatches,
  });
}

/**
 * Allows Admin to manually add a new scheduled fixture to a chosen round.
 */
export function addManualFixtureToSeason(
  season: Season,
  payload: {
    round: number;
    homeTeamId: string;
    awayTeamId: string;
  }
): Season {
  if (payload.homeTeamId === payload.awayTeamId) {
    throw new Error('Home team and away team must be different.');
  }
  const maxRound = season.format === 'home-away' ? 10 : 5;
  const clampedRound = Math.max(1, Math.min(maxRound, Math.floor(payload.round)));

  const newMatch: Match = {
    id: createId('m-manual'),
    round: clampedRound,
    homeTeamId: payload.homeTeamId,
    awayTeamId: payload.awayTeamId,
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    goals: [],
  };

  const updatedMatches = [...season.matches, newMatch].sort((a, b) => a.round - b.round);

  return syncSeasonKnockout({
    ...season,
    matches: updatedMatches,
  });
}

/**
 * Allows Admin to remove an unplayed or mistaken fixture from a season.
 */
export function deleteFixtureFromSeason(season: Season, matchId: string): Season {
  const updatedMatches = season.matches.filter((m) => m.id !== matchId);
  return syncSeasonKnockout({
    ...season,
    matches: updatedMatches,
  });
}
