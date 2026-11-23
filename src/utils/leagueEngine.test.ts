import test from 'node:test';
import assert from 'node:assert/strict';
import type { Season, Team } from '../types/league';
import {
  addManualFixtureToSeason,
  arrangeFixtureInSeason,
  calculatePlayerStats,
  calculateStandings,
  createEmptyKnockout,
  deleteFixtureFromSeason,
  generateRoundRobinFixtures,
  getSeasonChampion,
  recordPastMatchIntoSeason,
  reshuffleRemainingFixtures,
  syncSeasonKnockout,
  updateKnockoutMatchInSeason,
  updateMatchResultInSeason,
} from './leagueEngine';

const sampleTeams: Team[] = [
  { id: 't1', name: 'Real Dragons', shortName: 'RDR', logoId: 'real-madrid' },
  { id: 't2', name: 'Blaugrana Six', shortName: 'BLA', logoId: 'barcelona' },
  { id: 't3', name: 'Red Devils YGN', shortName: 'RDY', logoId: 'man-utd' },
  { id: 't4', name: 'Sky Citizens', shortName: 'SKY', logoId: 'man-city' },
  { id: 't5', name: 'Gunners FC', shortName: 'GUN', logoId: 'arsenal' },
  { id: 't6', name: 'Merseyside Reds', shortName: 'MER', logoId: 'liverpool' },
];

test('generateRoundRobinFixtures (once) produces 5 rounds, 15 unique pairings, no duplicate team per round', () => {
  const { matches } = generateRoundRobinFixtures(sampleTeams, 'once', [], 12345);
  assert.equal(matches.length, 15);

  const rounds = new Map<number, Set<string>>();
  const pairs = new Set<string>();

  for (const m of matches) {
    assert.ok(m.round >= 1 && m.round <= 5);
    assert.notEqual(m.homeTeamId, m.awayTeamId);
    const rSet = rounds.get(m.round) ?? new Set<string>();
    assert.equal(rSet.has(m.homeTeamId), false, 'Home team repeated in round');
    assert.equal(rSet.has(m.awayTeamId), false, 'Away team repeated in round');
    rSet.add(m.homeTeamId);
    rSet.add(m.awayTeamId);
    rounds.set(m.round, rSet);

    const key = [m.homeTeamId, m.awayTeamId].sort().join('::');
    assert.equal(pairs.has(key), false, `Duplicate pairing ${key}`);
    pairs.add(key);
  }

  assert.equal(rounds.size, 5);
  assert.equal(pairs.size, 15);
});

test('generateRoundRobinFixtures (home-away) produces 10 rounds, 30 directed fixtures', () => {
  const { matches } = generateRoundRobinFixtures(sampleTeams, 'home-away', [], 67890);
  assert.equal(matches.length, 30);

  const directedPairs = new Set<string>();
  const rounds = new Map<number, Set<string>>();

  for (const m of matches) {
    assert.ok(m.round >= 1 && m.round <= 10);
    const rSet = rounds.get(m.round) ?? new Set<string>();
    assert.equal(rSet.has(m.homeTeamId), false);
    assert.equal(rSet.has(m.awayTeamId), false);
    rSet.add(m.homeTeamId);
    rSet.add(m.awayTeamId);
    rounds.set(m.round, rSet);

    const key = `${m.homeTeamId}->${m.awayTeamId}`;
    assert.equal(directedPairs.has(key), false, `Duplicate directed fixture ${key}`);
    directedPairs.add(key);
  }

  assert.equal(rounds.size, 10);
  assert.equal(directedPairs.size, 30);
});

test('pre-played matches integrate cleanly without duplicating total fixture count', () => {
  const { matches } = generateRoundRobinFixtures(
    sampleTeams,
    'once',
    [
      {
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 3,
        awayScore: 1,
        playedAt: '2026-11-10',
        goals: [
          { teamId: 't1', scorer: 'Kyaw Kyaw', assist: 'Min Min' },
          { teamId: 't1', scorer: 'Kyaw Kyaw' },
          { teamId: 't1', scorer: 'Htet Aung', assist: 'Kyaw Kyaw' },
          { teamId: 't2', scorer: 'Zin Ko' },
        ],
      },
      {
        homeTeamId: 't3',
        awayTeamId: 't4',
        homeScore: 2,
        awayScore: 2,
        playedAt: '2026-11-11',
        goals: [],
      },
    ],
    999
  );

  assert.equal(matches.length, 15);
  const completed = matches.filter((m) => m.status === 'completed');
  assert.equal(completed.length, 2);
  assert.ok(completed.every((m) => m.isPrePlayed));

  const standings = calculateStandings(sampleTeams, matches);
  assert.equal(standings[0].team.id, 't1');
  assert.equal(standings[0].points, 3);
  assert.equal(standings[0].goalDifference, 2);
  assert.deepEqual(
    standings[0].form.map((f) => f.outcome),
    ['W']
  );

  // Zones: top 4 knockout, bottom 2 relegated
  assert.deepEqual(
    standings.map((r) => r.zone),
    ['knockout', 'knockout', 'knockout', 'knockout', 'relegated', 'relegated']
  );
});

test('calculateStandings caps form at last 5 matches in chronological order and breaks ties properly', () => {
  const { matches, nextCompletedOrder } = generateRoundRobinFixtures(sampleTeams, 'home-away', [], 42);
  let season: Season = {
    id: 's-test',
    name: 'Test Season',
    format: 'home-away',
    createdAt: '2026-11-01',
    status: 'active',
    teams: sampleTeams,
    matches,
    knockout: createEmptyKnockout('s-test'),
    nextCompletedOrder,
  };

  // Play 6 matches for t1 with known outcomes: W, L, D, W, W, L -> last 5 must be [L, D, W, W, L]
  const t1Matches = season.matches.filter(
    (m) => m.homeTeamId === 't1' || m.awayTeamId === 't1'
  );
  const outcomes: Array<'W' | 'D' | 'L'> = ['W', 'L', 'D', 'W', 'W', 'L'];

  outcomes.forEach((outcome, idx) => {
    const match = t1Matches[idx];
    const isHome = match.homeTeamId === 't1';
    let hs = 1;
    let as = 1;
    if (outcome === 'W') {
      hs = isHome ? 2 : 0;
      as = isHome ? 0 : 2;
    } else if (outcome === 'L') {
      hs = isHome ? 0 : 2;
      as = isHome ? 2 : 0;
    }
    season = updateMatchResultInSeason(season, match.id, {
      homeScore: hs,
      awayScore: as,
      goals: [],
    });
  });

  const standings = calculateStandings(season.teams, season.matches);
  const t1Row = standings.find((r) => r.team.id === 't1')!;
  assert.equal(t1Row.played, 6);
  assert.equal(t1Row.won, 3);
  assert.equal(t1Row.drawn, 1);
  assert.equal(t1Row.lost, 2);
  assert.equal(t1Row.points, 10);
  assert.deepEqual(
    t1Row.form.map((f) => f.outcome),
    ['L', 'D', 'W', 'W', 'L']
  );
});

test('knockout bracket seeds #1 vs #4 and #2 vs #3, handles penalties, and crowns champion', () => {
  const { matches, nextCompletedOrder } = generateRoundRobinFixtures(sampleTeams, 'once', [], 77);
  let season: Season = {
    id: 's-ko',
    name: 'KO Season',
    format: 'once',
    createdAt: '2026-11-01',
    status: 'active',
    teams: sampleTeams,
    matches,
    knockout: createEmptyKnockout('s-ko'),
    nextCompletedOrder,
  };

  // Record a past match so rankings are deterministic
  season = recordPastMatchIntoSeason(season, {
    homeTeamId: 't1',
    awayTeamId: 't6',
    homeScore: 4,
    awayScore: 0,
    goals: [
      { teamId: 't1', scorer: 'Aung Thu', assist: 'Nyein Chan' },
      { teamId: 't1', scorer: 'Aung Thu', assist: 'Nyein Chan' },
    ],
  });
  season = syncSeasonKnockout(season);

  const standings = calculateStandings(season.teams, season.matches);
  assert.equal(season.knockout.sf1.homeTeamId, standings[0].team.id);
  assert.equal(season.knockout.sf1.awayTeamId, standings[3].team.id);
  assert.equal(season.knockout.sf2.homeTeamId, standings[1].team.id);
  assert.equal(season.knockout.sf2.awayTeamId, standings[2].team.id);

  // SF1 decided on penalties (2-2, 4-3 pens -> home wins)
  season = updateKnockoutMatchInSeason(season, 'sf1', {
    homeScore: 2,
    awayScore: 2,
    homePenalties: 4,
    awayPenalties: 3,
    goals: [{ id: 'g1', teamId: standings[0].team.id, scorer: 'Aung Thu' }],
  });

  // SF2 decided in regular time (1-3 -> away wins)
  season = updateKnockoutMatchInSeason(season, 'sf2', {
    homeScore: 1,
    awayScore: 3,
    goals: [{ id: 'g2', teamId: standings[2].team.id, scorer: 'Soe Moe', assist: 'Lwin Moe' }],
  });

  assert.equal(season.knockout.final.homeTeamId, standings[0].team.id);
  assert.equal(season.knockout.final.awayTeamId, standings[2].team.id);

  // Final won by SF1 winner
  season = updateKnockoutMatchInSeason(season, 'final', {
    homeScore: 2,
    awayScore: 1,
    goals: [
      { id: 'g3', teamId: standings[0].team.id, scorer: 'Aung Thu', assist: 'Nyein Chan' },
    ],
  });

  const champion = getSeasonChampion(season);
  assert.equal(champion?.id, standings[0].team.id);

  const { topScorers, topAssists } = calculatePlayerStats([season], season.id);
  assert.equal(topScorers[0].playerName, 'Aung Thu');
  assert.equal(topScorers[0].goals, 4);
  assert.equal(topAssists[0].playerName, 'Nyein Chan');
  assert.equal(topAssists[0].assists, 3);
});

test('reshuffleRemainingFixtures keeps completed matches untouched', () => {
  const { matches, nextCompletedOrder } = generateRoundRobinFixtures(sampleTeams, 'once', [], 555);
  let season: Season = {
    id: 's-shuf',
    name: 'Shuffle Test',
    format: 'once',
    createdAt: '2026-11-01',
    status: 'active',
    teams: sampleTeams,
    matches,
    knockout: createEmptyKnockout('s-shuf'),
    nextCompletedOrder,
  };

  const firstMatchId = season.matches[0].id;
  season = updateMatchResultInSeason(season, firstMatchId, {
    homeScore: 2,
    awayScore: 1,
    goals: [],
  });

  const shuffled = reshuffleRemainingFixtures(season, 888);
  const completedAfter = shuffled.matches.find((m) => m.id === firstMatchId)!;
  assert.equal(completedAfter.status, 'completed');
  assert.equal(completedAfter.homeScore, 2);
  assert.equal(shuffled.matches.length, 15);
});

test('admin manual fixture arrangement updates round/teams, adds custom fixtures, and deletes fixtures', () => {
  const { matches, nextCompletedOrder } = generateRoundRobinFixtures(sampleTeams, 'once', [], 321);
  let season: Season = {
    id: 's-manual',
    name: 'ဇရှိလား Season 1',
    format: 'once',
    createdAt: '2026-11-23',
    status: 'active',
    teams: sampleTeams,
    matches,
    knockout: createEmptyKnockout('s-manual'),
    nextCompletedOrder,
  };

  const target = season.matches[0];
  season = arrangeFixtureInSeason(season, target.id, {
    round: 4,
    homeTeamId: 't5',
    awayTeamId: 't6',
  });
  const updated = season.matches.find((m) => m.id === target.id)!;
  assert.equal(updated.round, 4);
  assert.equal(updated.homeTeamId, 't5');
  assert.equal(updated.awayTeamId, 't6');

  season = addManualFixtureToSeason(season, {
    round: 2,
    homeTeamId: 't1',
    awayTeamId: 't3',
  });
  assert.equal(season.matches.length, 16);

  season = deleteFixtureFromSeason(season, target.id);
  assert.equal(season.matches.length, 15);
  assert.equal(season.matches.some((m) => m.id === target.id), false);
});
