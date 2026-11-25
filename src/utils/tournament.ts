import {
  GROUPS,
  GroupId,
  MAX_TEAMS_PER_GROUP,
  MatchDoc,
  MatchPair,
  ORGANIZER_WHATSAPP,
  StandingRow,
  TeamDoc,
} from '../types/tournament';

export function getTeamsInGroup(teams: TeamDoc[], group: GroupId): TeamDoc[] {
  return teams.filter((team) => team.group === group);
}

export function buildGroupPairs(teams: TeamDoc[], group: GroupId): MatchPair[] {
  const groupTeams = getTeamsInGroup(teams, group)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const result: MatchPair[] = [];
  for (let i = 0; i < groupTeams.length; i += 1) {
    for (let j = i + 1; j < groupTeams.length; j += 1) {
      const home = groupTeams[i];
      const away = groupTeams[j];
      result.push({
        id: `${group}_${home.id}_${away.id}`,
        group,
        home,
        away,
      });
    }
  }
  return result;
}

export function computeStandings(
  teams: TeamDoc[],
  matches: Record<string, MatchDoc>,
  group: GroupId
): StandingRow[] {
  const table: Record<string, StandingRow> = {};
  const groupTeams = getTeamsInGroup(teams, group);

  for (const team of groupTeams) {
    table[team.id] = {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    };
  }

  for (const pair of buildGroupPairs(teams, group)) {
    const match = matches[pair.id];
    if (!match || match.hs === null || match.hs === undefined || match.aw === null || match.aw === undefined) {
      continue;
    }
    const home = table[pair.home.id];
    const away = table[pair.away.id];
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.gf += match.hs;
    home.ga += match.aw;
    away.gf += match.aw;
    away.ga += match.hs;

    if (match.hs > match.aw) {
      home.won += 1;
      home.pts += 3;
      away.lost += 1;
    } else if (match.hs < match.aw) {
      away.won += 1;
      away.pts += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.pts += 1;
      away.pts += 1;
    }
  }

  return Object.values(table)
    .map((row) => ({ ...row, gd: row.gf - row.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export function pickAvailableGroup(
  teams: TeamDoc[],
  preference: 'AUTO' | GroupId
): GroupId | null {
  if (preference !== 'AUTO' && getTeamsInGroup(teams, preference).length < MAX_TEAMS_PER_GROUP) {
    return preference;
  }
  const available = GROUPS.filter(
    (g) => getTeamsInGroup(teams, g).length < MAX_TEAMS_PER_GROUP
  ).sort((a, b) => getTeamsInGroup(teams, a).length - getTeamsInGroup(teams, b).length);
  return available[0] ?? null;
}

export function buildWhatsAppRegistrationUrl(params: {
  name: string;
  phone: string;
  preferredGroup: string;
  players: string[];
  ref?: string;
}): string {
  const lines = [
    'طلب تسجيل في بطولة RISK UP',
    `الفرقة: ${params.name}`,
    `الكابتن: ${params.phone}`,
    `المجموعة المطلوبة: ${params.preferredGroup}`,
    `اللاعبون: ${params.players.join('، ')}`,
  ];
  if (params.ref) {
    lines.push(`رقم عملية InstaPay: ${params.ref}`);
  }
  return `https://wa.me/${ORGANIZER_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function extractTimestampMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds?: unknown }).seconds === 'number'
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}
