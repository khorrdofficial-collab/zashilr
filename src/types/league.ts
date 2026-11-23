export type ScheduleFormat = 'once' | 'home-away';

export type MatchStatus = 'scheduled' | 'completed';

export type FormOutcome = 'W' | 'D' | 'L';

export type TeamZone = 'knockout' | 'relegated';

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoId: string; // ID from CLUB_LOGO_PRESETS or 'custom'
  customLogoUrl?: string; // Data URL if user uploads a custom club crest
}

export interface GoalEvent {
  id: string;
  teamId: string;
  scorer: string;
  assist?: string;
  minute?: number;
}

export interface Match {
  id: string;
  round: number; // 1..5 (once) or 1..10 (home-away)
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  playedAt?: string; // ISO date string or YYYY-MM-DD
  completedOrder?: number; // Monotonic counter to preserve exact chronological order for Last-5 Form
  isPrePlayed?: boolean; // True when entered from prior real-world matches
  goals: GoalEvent[];
  note?: string;
}

export interface KnockoutMatch {
  id: string;
  stage: 'sf1' | 'sf2' | 'final';
  label: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  status: MatchStatus;
  playedAt?: string;
  goals: GoalEvent[];
}

export interface Season {
  id: string;
  name: string;
  format: ScheduleFormat;
  createdAt: string;
  completedAt?: string;
  status: 'active' | 'completed';
  teams: Team[]; // Exactly 6 teams
  matches: Match[];
  knockout: {
    sf1: KnockoutMatch;
    sf2: KnockoutMatch;
    final: KnockoutMatch;
  };
  nextCompletedOrder: number;
}

export interface FormEntry {
  matchId: string;
  outcome: FormOutcome;
  opponentId: string;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  isHome: boolean;
}

export interface StandingRow {
  rank: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: FormEntry[]; // Up to last 5 completed matches, oldest -> newest
  zone: TeamZone;
}

export interface PlayerStatRow {
  rank: number;
  playerName: string;
  teamId: string;
  teamName: string;
  teamLogoId: string;
  teamCustomLogoUrl?: string;
  goals: number;
  assists: number;
  contributions: number; // goals + assists
  matchesWithGoalOrAssist: number;
}

export interface PrePlayedMatchInput {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  playedAt?: string;
  goals: Omit<GoalEvent, 'id'>[];
  note?: string;
}
