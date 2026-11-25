export type GroupId = 'A' | 'B' | 'C' | 'D';
export type KnockoutRound = 'QF' | 'SF' | 'FINAL';
export type KnockoutSlotId = 'QF1' | 'QF2' | 'QF3' | 'QF4' | 'SF1' | 'SF2' | 'FINAL';

export const GROUPS: GroupId[] = ['A', 'B', 'C', 'D'];
export const MAX_TEAMS = 16;
export const MAX_TEAMS_PER_GROUP = 4;
export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 8;
export const ORGANIZER_WHATSAPP = '201278038467';
export const INSTAPAY_NUMBER = '01278038467';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'youssefeslam906@gmail.com';

// Synchronized verbatim with firebase-blueprint.json
export const ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const EGYPT_PHONE_PATTERN = /^01[0125][0-9]{8}$/;
export const TEAM_NAME_MAX_LENGTH = 30;
export const PLAYER_NAME_MAX_LENGTH = 30;
export const INSTAPAY_REF_MAX_LENGTH = 30;
export const MATCH_DATE_MAX_LENGTH = 30;
export const MATCH_TIME_MAX_LENGTH = 20;

export interface TeamDoc {
  id: string;
  name: string;
  group: GroupId;
  players: string[];
  paid: boolean;
  qualified?: boolean;
  ownerUid: string;
  createdAt?: unknown;
  createdAtMs?: number;
}

export interface TeamContactDoc {
  teamId: string;
  ownerUid: string;
  phone: string;
  ref: string;
  createdAt?: unknown;
}

export interface MatchDoc {
  id: string;
  group: GroupId;
  homeTeamId: string;
  awayTeamId: string;
  hs: number | null;
  aw: number | null;
  date: string;
  time: string;
  updatedAt?: unknown;
}

export interface KnockoutMatchDoc {
  id: KnockoutSlotId;
  round: KnockoutRound;
  label: string;
  homeName: string;
  awayName: string;
  hs: number | null;
  aw: number | null;
  date: string;
  time: string;
  winnerName: string;
  updatedAt?: unknown;
}

export const KNOCKOUT_SLOTS: { id: KnockoutSlotId; round: KnockoutRound; label: string }[] = [
  { id: 'QF1', round: 'QF', label: 'ربع النهائي 1' },
  { id: 'QF2', round: 'QF', label: 'ربع النهائي 2' },
  { id: 'QF3', round: 'QF', label: 'ربع النهائي 3' },
  { id: 'QF4', round: 'QF', label: 'ربع النهائي 4' },
  { id: 'SF1', round: 'SF', label: 'نصف النهائي 1' },
  { id: 'SF2', round: 'SF', label: 'نصف النهائي 2' },
  { id: 'FINAL', round: 'FINAL', label: 'النهائي' },
];

export interface ScorerDoc {
  id: string;
  playerName: string;
  teamName: string;
  goals: number;
  updatedAt?: unknown;
}

export interface MatchPair {
  id: string;
  group: GroupId;
  home: TeamDoc;
  away: TeamDoc;
}

export interface StandingRow {
  team: TeamDoc;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}
